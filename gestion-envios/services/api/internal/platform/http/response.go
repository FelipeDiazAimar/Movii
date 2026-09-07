package httpx

import (
	"encoding/json"
	"net/http"
)

// WriteJSON escribe payload como JSON con el status dado.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// APIError es el cuerpo estándar de error de la API.
type APIError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// WriteError escribe un error con el formato estándar {"error":{"code","message"}}.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	var body APIError
	body.Error.Code = code
	body.Error.Message = message
	WriteJSON(w, status, body)
}
