<?php
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.php';
$apiKey = file_exists($configFile) ? require $configFile : getenv('ANTHROPIC_API_KEY');

$entrada = json_decode(file_get_contents('php://input'), true);
if (!is_array($entrada)) {
    http_response_code(400);
    echo json_encode(['error' => 'Petición inválida']);
    exit;
}

if (!$apiKey || $apiKey === 'API_KEY' || $apiKey === 'PEGA_AQUI_TU_API_KEY') {
    $mensaje = $entrada['messages'][0]['content'] ?? '';
    $excluidas = isset($entrada['excluidas']) && is_array($entrada['excluidas']) ? $entrada['excluidas'] : [];
    $ingredientes = ['ingredientes seleccionados'];

    if (preg_match('/Tengo estos ingredientes:\s*([^\.]+)\./i', $mensaje, $m)) {
        $partes = array_filter(array_map('trim', explode(',', $m[1])));
        if (!empty($partes)) {
            $ingredientes = array_values($partes);
        }
    }

    $textoIngredientes = mb_strtolower(implode(' ', $ingredientes), 'UTF-8');
    $tienePan = (bool) preg_match('/\b(pan|franc[eé]s|bolillo|baguette|telera|tostada|tostadas)\b/u', $textoIngredientes);
    $tieneTortilla = (bool) preg_match('/\b(tortilla|tortillas|taco|tacos|burrito|burritos)\b/u', $textoIngredientes);
    $tieneArroz = (bool) preg_match('/\b(arroz)\b/u', $textoIngredientes);

    $huevos = [];
    $platanos = [];
    $frijoles = [];
    $frescos = [];
    $acompanantes = [];
    $carnes = [];
    $hervidos = [];
    $lacteos = [];
    $vegetales = [];

    foreach ($ingredientes as $ing) {
        if (preg_match('/huevo/i', $ing)) {
            $huevos[] = $ing;
        } elseif (preg_match('/pl[aá]tano|guineo/i', $ing)) {
            $platanos[] = $ing;
        } elseif (preg_match('/frijol/i', $ing)) {
            $frijoles[] = $ing;
        } elseif (preg_match('/aguacate|lim[oó]n|pepino|lechuga/i', $ing)) {
            $frescos[] = $ing;
        } elseif (preg_match('/pan|franc[eé]s|bolillo|tortilla/i', $ing)) {
            $acompanantes[] = $ing;
        } elseif (preg_match('/pollo|carne|res|cerdo|bistec|pechuga|salchicha|chorizo|jam[oó]n|tocino|at[uú]n|pescado|molida/i', $ing)) {
            $carnes[] = $ing;
        } elseif (preg_match('/arroz|pasta|fideo|espagueti|macarr[oó]n|papa|patata|lenteja|yuca/i', $ing)) {
            $hervidos[] = $ing;
        } elseif (preg_match('/queso|quesillo|cuajada|crema|leche|mantequilla|reques[oó]n|mozzarella/i', $ing)) {
            $lacteos[] = $ing;
        } else {
            $vegetales[] = $ing;
        }
    }

    $principal = $ingredientes[0];
    $secundario = $ingredientes[1] ?? null;
    $tituloCompuesto = $secundario ? ($principal . ' y ' . $secundario) : $principal;

    $listaVegetales = !empty($vegetales) ? implode(', ', $vegetales) : '';
    $listaCarnes = !empty($carnes) ? implode(', ', $carnes) : '';
    $listaHervidos = !empty($hervidos) ? implode(', ', $hervidos) : '';
    $listaLacteos = !empty($lacteos) ? implode(', ', $lacteos) : '';
    $listaFrescos = !empty($frescos) ? implode(', ', $frescos) : '';
    $listaAcompanantes = !empty($acompanantes) ? implode(' y ', $acompanantes) : '';

    $pasoPrevio = '';
    if ($listaHervidos && $listaCarnes) {
        $pasoPrevio = "Pon a cocer $listaHervidos en agua con sal durante 12 a 15 minutos hasta que ablande y escurre. Mientras tanto, corta $listaCarnes en trozos o rodajas y dóralos en una sartén con aceite caliente por 6 minutos hasta que estén bien cocidos.";
    } elseif ($listaHervidos) {
        $pasoPrevio = "Cocina $listaHervidos en una olla con agua y una pizca de sal durante 12 a 15 minutos hasta que esté suave (si ya lo tienes cocido, solo caliéntalo en sartén con un chorrito de aceite).";
    } elseif ($listaCarnes) {
        $pasoPrevio = "Corta $listaCarnes en trozos o rodajas medianas, sazona con sal y pimienta, y dóralos en una sartén caliente con un chorrito de aceite durante 6 a 8 minutos hasta que cocinen bien.";
    }

    $pasoFrijoles = !empty($frijoles)
        ? "En una sartén con una cucharadita de aceite caliente, sofríe los frijoles a fuego medio durante 4 a 5 minutos (puedes machacarlos ligeramente o dejarlos enteros) hasta que estén bien calientes."
        : '';

    $pasoPlatano = !empty($platanos)
        ? "Pela el plátano, córtalo en tajadas largas a lo largo o en rodajas diagonales y fríelo en una sartén con aceite a fuego medio durante 2 a 3 minutos por lado hasta que esté dorado y suave."
        : '';

    $pasoSofrito = $listaVegetales
        ? "Lava bien y pica finamente $listaVegetales. Calienta un chorrito de aceite en una sartén a fuego medio y sofríelos durante 4 minutos hasta que suelten su aroma y ablanden."
        : "Prepara una sartén amplia a fuego medio con una cucharadita de aceite y una pizca de sal para cocinar la base.";

    $huevoEstrelladoPicado = !empty($huevos)
        ? "En una sartén aparte con aceite caliente, haz el huevo estrellado friéndolo de 2 a 3 minutos hasta que la clara cuaje bien. Luego retíralo, pícalo en trozos medianos y añádelo a la demás mezcla."
        : "Integra los ingredientes calientes en la sartén principal y saltea a fuego medio durante 2 minutos para unificar los sabores.";

    $huevoDuroPicado = !empty($huevos)
        ? "Hierve los huevos en una olla pequeña con agua durante 10 minutos para hacerlos huevos duros. Pásalos por agua fría, pélalos, pícalos en rodajas o cubos y agrégalos a la preparación."
        : "Deja cocinar la mezcla tapada a fuego bajo durante 3 minutos adicionales revolviendo suavemente.";

    $huevoBatidoRevuelto = !empty($huevos)
        ? "Casca los huevos en un recipiente, agrega una pizca de sal y bátelos con un tenedor. Vierte el huevo batido en la sartén caliente y remueve durante 3 minutos hasta que cuaje junto con el sofrito."
        : "Saltea la preparación a fuego medio-alto durante 3 minutos moviendo constantemente para lograr un dorado parejo.";

    $huevoEstrelladoEncima = !empty($huevos)
        ? "Fríe los huevos en una sartén con aceite caliente por 3 minutos para hacerlos estrellados con las orillas doradas y colócalos sobre el plato."
        : "Rectifica el punto de sal y pimienta en la sartén y mezcla durante 2 minutos más antes de retirar del fuego.";

    $huevoTortillaTiras = !empty($huevos)
        ? "Bate los huevos con una pizca de sal, viértelos en la sartén caliente formando una torta delgada y cocínala 2 minutos por lado. Retírala, córtala en tiras y súmala al resto de ingredientes."
        : "Sazona con especias al gusto y saltea a fuego medio durante 3 minutos más.";

    $cierrePartes = [];
    if ($listaLacteos) {
        $cierrePartes[] = "acompaña o incorpora $listaLacteos al servir";
    }
    if ($listaFrescos) {
        $cierrePartes[] = "corta $listaFrescos en porciones frescas al lado del plato";
    }
    if ($listaAcompanantes) {
        $cierrePartes[] = "tuesta o calienta $listaAcompanantes en el comal o sartén por 2 minutos para acompañar";
    }

    $pasoFinalCierre = !empty($cierrePartes)
        ? "Para emplatar, " . implode(', ', $cierrePartes) . " y sirve recién hecho."
        : "Ajusta la sazón final con sal y pimienta al gusto y sirve bien caliente.";

    $ArmarPasos = function($pasosBase) {
        return array_values(array_filter($pasosBase, function($p) {
            return trim($p) !== '';
        }));
    };

    $recetasExactas = [
        [
            'nombre' => 'Plato casero completo de ' . $tituloCompuesto,
            'descripcion' => 'Preparación tradicional hecha al momento aprovechando todos los ingredientes de tu cocina.',
            'tiempo' => '15 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Pimienta', 'Aceite'],
            'ingredientes_extra' => [],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                $huevoEstrelladoEncima,
                $pasoFinalCierre
            ])
        ],
        [
            'nombre' => 'Salteado casero de ' . $tituloCompuesto,
            'descripcion' => 'Combinación al sartén bien sazonada con ingredientes cocinados paso a paso.',
            'tiempo' => '15 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Pimienta', 'Aceite'],
            'ingredientes_extra' => [],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                $huevoEstrelladoPicado,
                $pasoFinalCierre
            ])
        ],
        [
            'nombre' => 'Revuelto criollo de ' . $tituloCompuesto,
            'descripcion' => 'Receta suave y jugosa preparada en sartén con sazón de casa.',
            'tiempo' => '12 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Pimienta', 'Aceite'],
            'ingredientes_extra' => [],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                $huevoBatidoRevuelto,
                $pasoFinalCierre
            ])
        ],
        [
            'nombre' => 'Cazuela rústica de ' . $tituloCompuesto . ' al orégano',
            'descripcion' => 'Platillo reconfortante aromatizado con orégano y ajo sin requerir compras extra.',
            'tiempo' => '20 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Orégano', 'Ajo en polvo', 'Aceite'],
            'ingredientes_extra' => [],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                "Espolvorea una pizca de ajo en polvo y orégano seco sobre la sartén, integrando a fuego medio por 2 minutos.",
                $huevoDuroPicado,
                $pasoFinalCierre
            ])
        ],
        [
            'nombre' => 'Sartén dorada de ' . $tituloCompuesto,
            'descripcion' => 'Ingredientes salteados a fuego medio con textura dorada y sabor concentrado.',
            'tiempo' => '18 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Pimienta', 'Orégano', 'Aceite'],
            'ingredientes_extra' => [],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                $huevoTortillaTiras,
                $pasoFinalCierre
            ])
        ],
        [
            'nombre' => 'Guiso casero de ' . $tituloCompuesto,
            'descripcion' => 'Preparación jugosa cocinada a fuego lento con especias básicas de despensa.',
            'tiempo' => '20 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Comino', 'Ajo en polvo', 'Aceite'],
            'ingredientes_extra' => [],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                "Añade tres cucharadas de agua con una pizca de comino y ajo en polvo a la sartén, tapa y cocina a fuego bajo por 4 minutos.",
                $huevoEstrelladoPicado,
                $pasoFinalCierre
            ])
        ]
    ];

    $recetasConExtras = [
        [
            'nombre' => 'Panes o tostadas rellenas con ' . $tituloCompuesto,
            'descripcion' => 'Opción crujiente a la plancha rellenando pan francés o tortillas con tu preparación.',
            'tiempo' => '15 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Pimienta', 'Aceite'],
            'ingredientes_extra' => ($tienePan || $tieneTortilla) ? [] : ['Pan francés o tortillas'],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                $huevoEstrelladoPicado,
                "Abre el pan francés por la mitad o calienta las tortillas en la plancha, rellena con la preparación caliente y sirve."
            ])
        ],
        [
            'nombre' => 'Tacos caseros al comal de ' . $tituloCompuesto,
            'descripcion' => 'Tortillas calientes rellenas con la mezcla recién salida de la sartén.',
            'tiempo' => '18 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Aceite'],
            'ingredientes_extra' => $tieneTortilla ? [] : ['Tortillas'],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $pasoSofrito,
                $huevoBatidoRevuelto,
                "Calienta las tortillas en el comal o sartén, sirve la preparación en el centro y acompaña con el resto de tus ingredientes."
            ])
        ],
        [
            'nombre' => 'Arroz casero salteado con ' . $tituloCompuesto,
            'descripcion' => 'Variante rendidora integrando arroz en la misma sartén.',
            'tiempo' => '20 min',
            'ingredientes_usados' => $ingredientes,
            'sazones' => ['Sal', 'Pimienta', 'Aceite'],
            'ingredientes_extra' => $tieneArroz ? [] : ['Arroz cocido'],
            'pasos' => $ArmarPasos([
                $pasoPrevio,
                $pasoFrijoles,
                $pasoPlatano,
                $huevoTortillaTiras,
                $pasoSofrito,
                "Incorpora el arroz cocido a la sartén junto con todos los ingredientes preparados, saltea a fuego medio-alto por 4 minutos y sirve."
            ])
        ]
    ];

    $purasFinal = $recetasExactas;
    $extrasFinal = [];
    foreach ($recetasConExtras as $r) {
        if (empty($r['ingredientes_extra'])) {
            $purasFinal[] = $r;
        } else {
            $extrasFinal[] = $r;
        }
    }

    $purasDisponibles = array_values(array_filter($purasFinal, function($item) use ($excluidas) {
        return !in_array($item['nombre'], $excluidas, true);
    }));
    if (count($purasDisponibles) < 3) {
        $purasDisponibles = $purasFinal;
    }

    $extrasDisponibles = array_values(array_filter($extrasFinal, function($item) use ($excluidas) {
        return !in_array($item['nombre'], $excluidas, true);
    }));
    if (count($extrasDisponibles) < 1) {
        $extrasDisponibles = $extrasFinal;
    }

    shuffle($purasDisponibles);
    shuffle($extrasDisponibles);

    $seleccionadas = array_slice($purasDisponibles, 0, 3);
    if (!empty($extrasDisponibles)) {
        $seleccionadas[] = $extrasDisponibles[0];
    }

    echo json_encode([
        'content' => [
            [
                'type' => 'text',
                'text' => json_encode($seleccionadas, JSON_UNESCAPED_UNICODE)
            ]
        ]
    ]);
    exit;
}

$cuerpo = [
    'model'      => 'claude-sonnet-4-6',
    'max_tokens' => 2000,
    'system'     => $entrada['system'] ?? '',
    'messages'   => $entrada['messages'] ?? [],
];

$ch = curl_init('[https://api.anthropic.com/v1/messages](https://api.anthropic.com/v1/messages)');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS     => json_encode($cuerpo),
    CURLOPT_TIMEOUT        => 60,
]);

$respuesta = curl_exec($ch);
$codigo    = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($respuesta === false) {
    http_response_code(502);
    echo json_encode(['error' => curl_error($ch)]);
    exit;
}

http_response_code($codigo);
echo $respuesta;