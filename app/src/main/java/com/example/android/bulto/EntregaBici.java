package com.example.android.bulto;

/**
 * Created by Nello on 04/04/2017.
 */

public class EntregaBici extends Entrega {
    public EntregaBici(String nombre, String email, String compra, String peso, String diaEntrega, int precio) {
        super(nombre, email, compra, peso, diaEntrega, precio);

    }


    @Override
    public void anadirBulto() {
        super.bultos += 2;

    }
}
