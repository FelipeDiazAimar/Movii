package whatsapp

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // driver "pgx" para database/sql
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// Cliente es el Sender real sobre whatsmeow. La sesión (claves del
// dispositivo vinculado) se guarda en las tablas whatsmeow_* de la misma
// base, así sobrevive a reinicios y redeploys sin disco persistente.
type Cliente struct {
	db        *sql.DB
	container *sqlstore.Container
	logWA     waLog.Logger

	mu        sync.Mutex
	cli       *whatsmeow.Client
	qr        string
	qrVence   time.Time
	vinculand bool
	jids      map[string]types.JID // caché teléfono → JID real (WhatsApp devuelve 54 9 o 54 según la cuenta)
}

// NuevoCliente abre la sesión guardada en la base (databaseURL) y conecta.
// Si no hay sesión, queda esperando que el supervisor escanee el QR.
func NuevoCliente(ctx context.Context, databaseURL string) (*Cliente, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(4)
	logWA := waLog.Stdout("WhatsApp", "WARN", false)
	container := sqlstore.NewWithDB(db, "postgres", logWA)
	if err := container.Upgrade(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("whatsapp: no se pudieron crear las tablas de sesión: %w", err)
	}
	c := &Cliente{db: db, container: container, logWA: logWA, jids: map[string]types.JID{}}
	if err := c.arrancar(ctx); err != nil {
		return nil, err
	}
	return c, nil
}

// arrancar crea el cliente sobre el primer dispositivo guardado (o uno nuevo) y,
// si ya estaba vinculado, conecta.
func (c *Cliente) arrancar(ctx context.Context) error {
	device, err := c.container.GetFirstDevice(ctx)
	if err != nil {
		return err
	}
	store.DeviceProps.Os = proto.String("Movii")
	cli := whatsmeow.NewClient(device, c.logWA)
	cli.EnableAutoReconnect = true
	cli.AddEventHandler(c.alEvento)

	c.mu.Lock()
	c.cli = cli
	c.mu.Unlock()

	if cli.Store.ID == nil {
		log.Printf("whatsapp: sin cuenta vinculada; escaneá el QR desde Configuración → WhatsApp")
		return nil
	}
	return cli.Connect()
}

func (c *Cliente) alEvento(evt any) {
	switch e := evt.(type) {
	case *events.Connected:
		log.Printf("whatsapp: conectado")
	case *events.LoggedOut:
		log.Printf("whatsapp: la sesión se cerró desde el teléfono (%v)", e.Reason)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := c.arrancar(ctx); err != nil {
				log.Printf("whatsapp: no se pudo reiniciar el cliente: %v", err)
			}
		}()
	}
}

// Estado implementa Sender.
func (c *Cliente) Estado() Estado {
	c.mu.Lock()
	defer c.mu.Unlock()
	e := Estado{Habilitado: true}
	if c.cli == nil {
		return e
	}
	e.Conectado = c.cli.IsConnected()
	e.Vinculado = c.cli.Store.ID != nil
	if e.Vinculado {
		e.Numero = c.cli.Store.ID.User
	}
	if !e.Vinculado && c.qr != "" && time.Now().Before(c.qrVence) {
		e.QR, e.QRVence = c.qr, c.qrVence
	}
	return e
}

// IniciarVinculacion implementa Administrable: pide a WhatsApp códigos QR
// (uno nuevo cada ~20 s) hasta que alguien escanee o se agoten.
func (c *Cliente) IniciarVinculacion(ctx context.Context) error {
	c.mu.Lock()
	cli := c.cli
	if cli == nil || cli.Store.ID != nil || c.vinculand {
		c.mu.Unlock()
		return nil
	}
	c.vinculand = true
	c.mu.Unlock()

	// El canal de QR vive más que la request que lo pidió.
	qrCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	canal, err := cli.GetQRChannel(qrCtx)
	if err != nil {
		cancel()
		c.mu.Lock()
		c.vinculand = false
		c.mu.Unlock()
		return err
	}
	if !cli.IsConnected() {
		if err := cli.Connect(); err != nil {
			cancel()
			c.mu.Lock()
			c.vinculand = false
			c.mu.Unlock()
			return err
		}
	}
	go func() {
		defer cancel()
		for item := range canal {
			c.mu.Lock()
			switch item.Event {
			case whatsmeow.QRChannelEventCode:
				c.qr, c.qrVence = item.Code, time.Now().Add(item.Timeout)
			default:
				c.qr = ""
				if item.Event == whatsmeow.QRChannelSuccess.Event {
					log.Printf("whatsapp: cuenta vinculada")
				} else if item.Error != nil {
					log.Printf("whatsapp: vinculación: %s (%v)", item.Event, item.Error)
				}
			}
			c.mu.Unlock()
		}
		c.mu.Lock()
		c.vinculand = false
		c.mu.Unlock()
	}()
	return nil
}

// Desvincular implementa Administrable.
func (c *Cliente) Desvincular(ctx context.Context) error {
	c.mu.Lock()
	cli := c.cli
	c.jids = map[string]types.JID{}
	c.mu.Unlock()
	if cli == nil || cli.Store.ID == nil {
		return nil
	}
	if err := cli.Logout(ctx); err != nil {
		return err
	}
	cli.Disconnect()
	return c.arrancar(ctx)
}

// Enviar implementa Sender.
func (c *Cliente) Enviar(ctx context.Context, telefono, texto string) error {
	c.mu.Lock()
	cli := c.cli
	c.mu.Unlock()
	if cli == nil || cli.Store.ID == nil || !cli.IsLoggedIn() {
		return ErrNoVinculado
	}
	jid, err := c.resolverJID(ctx, cli, telefono)
	if err != nil {
		return err
	}
	_, err = cli.SendMessage(ctx, jid, &waE2E.Message{Conversation: proto.String(texto)})
	return err
}

// resolverJID pregunta a WhatsApp cuál es la cuenta real del número (en
// Argentina algunas cuentas figuran con el 9 y otras sin él) y la cachea.
func (c *Cliente) resolverJID(ctx context.Context, cli *whatsmeow.Client, telefono string) (types.JID, error) {
	c.mu.Lock()
	if jid, ok := c.jids[telefono]; ok {
		c.mu.Unlock()
		return jid, nil
	}
	c.mu.Unlock()

	res, err := cli.IsOnWhatsApp(ctx, []string{"+" + telefono})
	if err != nil {
		return types.JID{}, err
	}
	for _, r := range res {
		if r.IsIn {
			c.mu.Lock()
			c.jids[telefono] = r.JID
			c.mu.Unlock()
			return r.JID, nil
		}
	}
	return types.JID{}, ErrSinWhatsApp
}

// Cerrar desconecta y libera la base.
func (c *Cliente) Cerrar() {
	c.mu.Lock()
	if c.cli != nil {
		c.cli.Disconnect()
	}
	c.mu.Unlock()
	_ = c.db.Close()
}
