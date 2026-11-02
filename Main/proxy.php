<?php
// Proxy local: el navegador llama a este archivo y este llama a la API de Anthropic.
// Así la API key nunca llega al navegador.
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.php';
$apiKey = file_exists($configFile) ? require $configFile : getenv('ANTHROPIC_API_KEY');

if (!$apiKey || $apiKey === 'PEGA_AQUI_TU_API_KEY') {
    http_response_code(500);
    echo json_encode(['error' => 'Falta la API key en config.php']);
    exit;
}

$entrada = json_decode(file_get_contents('php://input'), true);
if (!is_array($entrada)) {
    http_response_code(400);
    echo json_encode(['error' => 'Petición inválida']);
    exit;
}

// Solo se reenvían los campos necesarios
$cuerpo = [
    'model'      => 'claude-sonnet-4-6',
    'max_tokens' => 2000,
    'system'     => $entrada['system'] ?? '',
    'messages'   => $entrada['messages'] ?? [],
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
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
