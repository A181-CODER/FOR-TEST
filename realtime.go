package main

import (
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, _ := upgrader.Upgrade(w, r, nil)
	defer ws.Close()

	for {
        // الاستماع لأي رسالة (مثلاً من الـ AI)
		_, msg, _ := ws.ReadMessage()
        
        // إعادة إرسالها فوراً للمتصفح (Proctor Dashboard)
        // هذا يضمن أن العميد يرى الغش في لحظة حدوثه
		fmt.Printf("Alert Received: %s\n", msg)
		ws.WriteMessage(websocket.TextMessage, msg)
	}
}

func main() {
	http.HandleFunc("/ws", handleConnections)
	fmt.Println("Realtime Alert Server started on :8080")
	http.ListenAndServe(":8080", nil)
}