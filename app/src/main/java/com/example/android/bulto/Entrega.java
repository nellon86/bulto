package com.example.android.bulto;

/**
 * Created by Nello on 02/04/2017.
 */

public class Entrega {
    String nombre;
    String email;
    String compra;
    String peso;
    String diaEntrega;
    int precio;
    public static int bultos;

    public Entrega(String nombre, String email, String compra, String peso, String diaEntrega, int precio) {
        this.nombre = nombre;
        this.email = email;
        this.compra = compra;
        this.peso = peso;
        this.diaEntrega = diaEntrega;
        this.precio = precio;
        anadirBulto();
    }

    public void anadirBulto(){
        bultos++;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCompra() {
        return compra;
    }

    public void setCompra(String compra) {
        this.compra = compra;
    }

    public int getBultos() {
        return bultos;
    }

    public void setBultos(int bultos) {
        this.bultos = bultos;
    }

    public String getPeso() {
        return peso;
    }

    public void setPeso(String peso) {
        this.peso = peso;
    }

    public String getDiaEntrega() {
        return diaEntrega;
    }

    public void setDiaEntrega(String diaEntrega) {
        this.diaEntrega = diaEntrega;
    }

    public int getPrecio() {
        return precio;
    }

    public void setPrecio(int precio) {
        this.precio = precio;
    }

    @Override
    public String toString() {
        return "Los datos de la compra son:" + '\''+
                "nombre: '" + nombre + '\'' +
                ", email: '" + email + '\'' +
                ", tipo: '" + compra + '\'' +
                ", peso: " + peso +
                ", plazo de entrega: '" + diaEntrega + '\'' +
                ", y precio final de: " + precio +
                '€';
    }
}
