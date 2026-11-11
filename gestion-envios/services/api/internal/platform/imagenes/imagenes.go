// Package imagenes dibuja las imágenes de las entregas de demostración: una
// firma manuscrita (PNG transparente) y una foto del paquete en la puerta
// (JPEG). Las usan cmd/demo y el simulador de entregas, para que el detalle
// del envío muestre imágenes reales. Hay pocas variantes y se reutilizan.
package imagenes

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"math"
	"math/rand/v2"
	"sync"
)

// Variantes es cuántas firmas y fotos distintas hay.
const Variantes = 6

var (
	imagenesUna sync.Once
	firmas      [Variantes][]byte
	fotos       [Variantes][]byte
)

func preparar() {
	imagenesUna.Do(func() {
		for i := range Variantes {
			firmas[i] = dibujarFirma(uint64(i + 1))
			fotos[i] = dibujarFoto(uint64(i + 1))
		}
	})
}

// Variante devuelve la firma y la foto número i (0 ≤ i < Variantes).
func Variante(i int) (firma, foto []byte) {
	preparar()
	return firmas[i%Variantes], fotos[i%Variantes]
}

// Firma devuelve una de las firmas (PNG).
func Firma(rnd *rand.Rand) []byte {
	preparar()
	return firmas[rnd.IntN(Variantes)]
}

// Foto devuelve una de las fotos de entrega (JPEG).
func Foto(rnd *rand.Rand) []byte {
	preparar()
	return fotos[rnd.IntN(Variantes)]
}

// punto pinta un disco con borde suave (trazo antialias simple).
func punto(img *image.NRGBA, cx, cy, r float64, c color.NRGBA) {
	x0, x1 := int(cx-r-1), int(cx+r+1)
	y0, y1 := int(cy-r-1), int(cy+r+1)
	for y := y0; y <= y1; y++ {
		for x := x0; x <= x1; x++ {
			if !(image.Point{x, y}.In(img.Rect)) {
				continue
			}
			d := math.Hypot(float64(x)-cx, float64(y)-cy)
			a := math.Max(0, math.Min(1, r-d+0.5))
			if a == 0 {
				continue
			}
			prev := img.NRGBAAt(x, y)
			na := math.Max(float64(prev.A)/255, a)
			img.SetNRGBA(x, y, color.NRGBA{c.R, c.G, c.B, uint8(na * 255)})
		}
	}
}

// dibujarFirma traza una firma cursiva: una inicial grande con lazo, una
// escritura corrida (trocoide: avanza haciendo bucles como "lll") inclinada
// y un subrayado que vuelve hacia atrás.
func dibujarFirma(semilla uint64) []byte {
	rnd := rand.New(rand.NewPCG(semilla, 77))
	const ancho, alto = 360, 130
	img := image.NewNRGBA(image.Rect(0, 0, ancho, alto))
	tinta := color.NRGBA{R: 22, G: 38, B: 92, A: 255}
	grosor := 1.3 + rnd.Float64()*0.5
	inclina := 0.28 + rnd.Float64()*0.15
	base := 78.0
	trazo := func(x, y, g float64) { punto(img, x+(base-y)*inclina, y, g, tinta) }

	// Inicial: un óvalo grande abierto que baja y se engancha a la escritura.
	cx, cy := 48+rnd.Float64()*10, 52.0
	rx, ry := 16+rnd.Float64()*6, 30+rnd.Float64()*8
	for a := 0.6; a < 2*math.Pi+1.2; a += 0.004 {
		trazo(cx+rx*math.Cos(a+math.Pi/2), cy+ry*math.Sin(a+math.Pi/2)*0.9, grosor*1.15)
	}
	// Escritura corrida: bucles de altura variable.
	lazos := 7 + rnd.IntN(5)
	x0, x1 := cx+rx*0.6, 285+rnd.Float64()*25
	for t := 0.0; t <= 1; t += 0.0004 {
		fase := 2 * math.Pi * float64(lazos) * t
		env := 0.55 + 0.45*math.Abs(math.Sin(t*math.Pi*(1.5+float64(semilla%3))))
		r := (7 + 5*env) * (1 - 0.35*t)
		x := x0 + (x1-x0)*t - r*0.9*math.Sin(fase)
		y := base - r*(1-math.Cos(fase))*env*1.4
		trazo(x, y, grosor*(0.8+0.3*math.Cos(fase)))
	}
	// Subrayado: sale del final y vuelve hacia la izquierda con una curva.
	for t := 0.0; t <= 1; t += 0.0015 {
		x := x1 - t*(x1-40)
		y := base + 14 + 10*math.Sin(t*math.Pi)*(0.4+rnd.Float64()*0.001) - 6*t
		punto(img, x, y, grosor*(1-0.6*t), tinta)
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func rellenar(img *image.RGBA, r image.Rectangle, c color.RGBA) {
	draw.Draw(img, r, &image.Uniform{C: c}, image.Point{}, draw.Src)
}

// dibujarFoto arma una "foto" de entrega: pared, puerta, piso y la caja con cinta y etiqueta.
func dibujarFoto(semilla uint64) []byte {
	rnd := rand.New(rand.NewPCG(semilla, 91))
	const ancho, alto = 480, 360
	img := image.NewRGBA(image.Rect(0, 0, ancho, alto))

	paredes := []color.RGBA{{222, 214, 199, 255}, {205, 213, 219, 255}, {231, 222, 205, 255}, {214, 205, 214, 255}}
	pared := paredes[rnd.IntN(len(paredes))]
	// Pared con un leve degradé vertical.
	for y := 0; y < 250; y++ {
		k := 1 - float64(y)/900
		rellenar(img, image.Rect(0, y, ancho, y+1), color.RGBA{uint8(float64(pared.R) * k), uint8(float64(pared.G) * k), uint8(float64(pared.B) * k), 255})
	}
	// Puerta de madera o metálica.
	puertas := []color.RGBA{{120, 78, 46, 255}, {74, 86, 98, 255}, {150, 104, 64, 255}}
	px := 150 + rnd.IntN(120)
	rellenar(img, image.Rect(px, 30, px+150, 250), puertas[rnd.IntN(len(puertas))])
	rellenar(img, image.Rect(px+120, 140, px+132, 150), color.RGBA{210, 190, 120, 255}) // picaporte
	// Zócalo y piso (cerámico con juntas).
	rellenar(img, image.Rect(0, 245, ancho, 252), color.RGBA{90, 90, 92, 255})
	for y := 252; y < alto; y++ {
		g := uint8(150 + (y-252)/6)
		rellenar(img, image.Rect(0, y, ancho, y+1), color.RGBA{g, g - 6, g - 14, 255})
	}
	for x := -200; x < ancho; x += 70 {
		for y := 252; y < alto; y++ {
			xx := x + (y-252)*2
			if xx >= 0 && xx < ancho {
				img.Set(xx, y, color.RGBA{120, 116, 108, 255})
			}
		}
	}
	// Caja de cartón con sombra, cinta y etiqueta.
	cw, ch := 130+rnd.IntN(50), 90+rnd.IntN(35)
	cx := 60 + rnd.IntN(ancho-cw-120)
	cy := 300 - ch
	rellenar(img, image.Rect(cx+8, cy+ch-4, cx+cw+18, cy+ch+10), color.RGBA{60, 56, 50, 120})
	rellenar(img, image.Rect(cx, cy, cx+cw, cy+ch), color.RGBA{191, 145, 92, 255})
	rellenar(img, image.Rect(cx, cy, cx+cw, cy+14), color.RGBA{171, 126, 76, 255})
	rellenar(img, image.Rect(cx+cw/2-8, cy, cx+cw/2+8, cy+ch), color.RGBA{214, 184, 130, 255})
	rellenar(img, image.Rect(cx+12, cy+30, cx+58, cy+62), color.RGBA{246, 246, 240, 255})
	for i := 0; i < 4; i++ {
		rellenar(img, image.Rect(cx+16, cy+35+i*6, cx+50-rnd.IntN(12), cy+37+i*6), color.RGBA{70, 70, 70, 255})
	}
	// Franja amarilla de Movii en la etiqueta.
	rellenar(img, image.Rect(cx+12, cy+30, cx+58, cy+33), color.RGBA{244, 180, 0, 255})

	var b bytes.Buffer
	_ = jpeg.Encode(&b, img, &jpeg.Options{Quality: 72})
	return b.Bytes()
}
