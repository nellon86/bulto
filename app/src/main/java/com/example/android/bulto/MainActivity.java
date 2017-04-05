package com.example.android.bulto;

import android.os.Bundle;
import android.support.annotation.IdRes;
import android.support.v7.app.AppCompatActivity;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

import static android.R.layout.simple_spinner_item;

public class MainActivity extends AppCompatActivity {

    int precio = 20;
    EditText txtNombre;
    EditText txtEmail;
    Spinner tipoEntrega;
    Spinner pesoBulto;
    ImageView imagen;
    TextView txtPeso;
    CheckBox cliePref;
    RadioGroup plazoEntrega;
    Button agregar;
    Button cancelar;
    Button entrgaBici;
    Button bultos;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        cliePref = (CheckBox) findViewById(R.id.checkBox);
        txtNombre = (EditText) findViewById(R.id.txtNombre);
        imagen = (ImageView) findViewById(R.id.imageView2);
        txtEmail = (EditText) findViewById(R.id.txtCorreo);
        txtPeso = (TextView) findViewById(R.id.txtPeso);
        tipoEntrega = (Spinner) findViewById(R.id.spinner);
        pesoBulto = (Spinner) findViewById(R.id.spinner2);
        cancelar = (Button) findViewById(R.id.button);
        agregar = (Button) findViewById(R.id.button2);
        entrgaBici = (Button) findViewById(R.id.button3);
        bultos = (Button) findViewById(R.id.button4);
        final String[] tipoCompra = new String[2];
        final String[] entregaTipo = new String[1];
        final List tipo = new ArrayList<String>();
        tipo.add("Carta");
        tipo.add("Bulto");
        ArrayAdapter<String> adaptador = new ArrayAdapter<String>(getApplicationContext(), simple_spinner_item, tipo);
        tipoEntrega.setAdapter(adaptador);
        tipoEntrega.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String eleccion = String.valueOf(tipoEntrega.getSelectedItem());
                tipoCompra[0] = eleccion;
                if (eleccion.equals("Carta")) {
                    imagen.setImageResource(R.drawable.busta_lettera);
                    List tipocarta = new ArrayList<String>();
                    tipocarta.add("Normal");
                    tipocarta.add("Grande");
                    tipocarta.add("Extragrande");
                    ArrayAdapter<String> adaptCarta = new ArrayAdapter<String>(getApplicationContext(), simple_spinner_item, tipocarta);
                    pesoBulto.setAdapter(adaptCarta);
                    pesoBulto.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                        @Override
                        public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                            String dimension = String.valueOf(pesoBulto.getSelectedItem());
                            tipoCompra[1] = dimension;
                            txtPeso.setText(dimension);
                            if (dimension.equals("Grande")) {
                                precio += 25;
                            } else if (dimension.equals("Extragrande")) {
                                precio += 35;
                            }
                        }

                        @Override
                        public void onNothingSelected(AdapterView<?> parent) {

                        }
                    });
                } else {
                    imagen.setImageResource(R.drawable.packageicon);
                    List peso = new ArrayList<Integer>();
                    for (int i = 0; i < 101; i++) {
                        peso.add(Integer.toString(i));
                    }
                    ArrayAdapter<Integer> adapter = new ArrayAdapter<Integer>(getApplicationContext(), simple_spinner_item, peso);
                    pesoBulto.setAdapter(adapter);
                    pesoBulto.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                        @Override
                        public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                            int pesoSelec = pesoBulto.getSelectedItemPosition();
                            tipoCompra[1] = String.valueOf(pesoSelec);
                            txtPeso.setText(String.valueOf(pesoSelec) + "kg");
                            if (pesoSelec > 20 && pesoSelec < 40) {
                                precio += 20;
                            }
                            if (pesoSelec >= 40) {
                                precio += 30;
                            }
                        }

                        @Override
                        public void onNothingSelected(AdapterView<?> parent) {

                        }
                    });
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {

            }
        });

        cliePref.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                precio = precio - (int)((precio / 100f) * 10f);
            }
        });

        plazoEntrega = (RadioGroup) findViewById(R.id.radioGroup);
        plazoEntrega.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, @IdRes int checkedId) {
                if (checkedId == R.id.inmed) {
                    entregaTipo[0] = "Inmediata";
                    precio += 40;
                } else if (checkedId == R.id.undia) {
                    entregaTipo[0] = "Un día";
                    precio += 20;
                } else if (checkedId == R.id.dosdias) {
                    entregaTipo[0] = "Dos días";
                    precio += 10;
                }
            }
        });


        agregar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String nombre = txtNombre.getText().toString();
                String correo = txtEmail.getText().toString();
                String compra = tipoCompra[0];
                String peso = tipoCompra[1];
                String entregaSelec = entregaTipo[0];
                Entrega bulto = new Entrega(nombre, correo, compra, peso, entregaSelec, precio);
                Toast.makeText(getApplicationContext(), bulto.toString(), Toast.LENGTH_LONG).show();
            }
        });

        cancelar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                recreate();
                txtNombre.setText("");
                txtEmail.setText("");
            }
        });

        entrgaBici.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String nombre = txtNombre.getText().toString();
                String correo = txtEmail.getText().toString();
                String compra = tipoCompra[0];
                String peso = tipoCompra[1];
                String entregaSelec = entregaTipo[0];
                EntregaBici bulto = new EntregaBici(nombre, correo, compra, peso, entregaSelec, precio);
                Toast.makeText(getApplicationContext(), bulto.toString(), Toast.LENGTH_LONG).show();
            }
        });

        bultos.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                int bultosTot = Entrega.bultos;
                Toast.makeText(getApplicationContext(), "Hay " + bultosTot + " ordenes", Toast.LENGTH_LONG).show();
            }
        });


    }
}
