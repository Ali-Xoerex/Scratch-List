package main

import (
	"database/sql"
	"fmt"
	"net/http"
	_ "github.com/glebarez/go-sqlite"
)


func main() {
	// home := template.Must(template.ParseFiles("index.html"))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w,r, "index.html")
	})

	fs := http.FileServer(http.Dir("static/"))
	http.Handle("/static/", http.StripPrefix("/static/",fs))

	fmt.Println("Server is running on 8080 port")
	err := http.ListenAndServe(":8080",nil)
	if err != nil {
		fmt.Println("Server error: ",err)
	}
}