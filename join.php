<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$dataFile = dirname(__DIR__, 2) . '/bargainest-waitlist.csv';


function respond($status, $data)
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| GET - Waitlist count
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    if (
        isset($_GET['action']) &&
        $_GET['action'] === 'count'
    ) {

        $count = 0;

        if (file_exists($dataFile)) {

            $handle = fopen($dataFile, 'r');

            if ($handle !== false) {

                while (($row = fgetcsv($handle)) !== false) {

                    if (
                        isset($row[1]) &&
                        $row[1] !== 'email'
                    ) {
                        $count++;
                    }
                }

                fclose($handle);
            }
        }

        respond(200, [
            'count' => $count
        ]);
    }

    respond(405, [
        'message' => 'Method not allowed.'
    ]);
}


/*
|--------------------------------------------------------------------------
| POST - Add person to waitlist
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    respond(405, [
        'message' => 'Method not allowed.'
    ]);
}


/*
|--------------------------------------------------------------------------
| Read request body
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents('php://input');

$input = json_decode($rawInput, true);


/*
|--------------------------------------------------------------------------
| Validate request
|--------------------------------------------------------------------------
*/

if (!is_array($input)) {

    respond(400, [
        'message' => 'Invalid submission received.'
    ]);
}


/*
|--------------------------------------------------------------------------
| Get name and email
|--------------------------------------------------------------------------
*/

$name = trim(
    (string)($input['name'] ?? '')
);

$email = strtolower(
    trim(
        (string)($input['email'] ?? '')
    )
);


/*
|--------------------------------------------------------------------------
| Validate name
|--------------------------------------------------------------------------
*/

if ($name === '') {

    respond(422, [
        'message' => 'Please enter your name.'
    ]);
}


/*
|--------------------------------------------------------------------------
| Validate email
|--------------------------------------------------------------------------
*/

if (!filter_var(
    $email,
    FILTER_VALIDATE_EMAIL
)) {

    respond(422, [
        'message' => 'Please enter a valid email address.'
    ]);
}


/*
|--------------------------------------------------------------------------
| Check for duplicate email
|--------------------------------------------------------------------------
*/

if (file_exists($dataFile)) {

    $handle = fopen($dataFile, 'r');

    if ($handle !== false) {

        while (($row = fgetcsv($handle)) !== false) {

            if (
                isset($row[1]) &&
                strtolower(trim($row[1])) === $email
            ) {

                fclose($handle);

                respond(409, [
                    'message' =>
                        "You're already on the BargaiNest waitlist."
                ]);
            }
        }

        fclose($handle);
    }
}


/*
|--------------------------------------------------------------------------
| Open waitlist file
|--------------------------------------------------------------------------
*/

$isNewFile = !file_exists($dataFile);

$handle = fopen($dataFile, 'a');

if ($handle === false) {

    respond(500, [
        'message' =>
            'Unable to save your registration. Please try again.'
    ]);
}


/*
|--------------------------------------------------------------------------
| Lock file
|--------------------------------------------------------------------------
*/

if (!flock($handle, LOCK_EX)) {

    fclose($handle);

    respond(500, [
        'message' =>
            'Unable to save your registration. Please try again.'
    ]);
}


/*
|--------------------------------------------------------------------------
| Create CSV header
|--------------------------------------------------------------------------
*/

if ($isNewFile) {

    fputcsv(
        $handle,
        [
            'joined_at',
            'email',
            'name'
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Save registration
|--------------------------------------------------------------------------
*/

fputcsv(
    $handle,
    [
        date('c'),
        $email,
        $name
    ]
);


/*
|--------------------------------------------------------------------------
| Finish
|--------------------------------------------------------------------------
*/

fflush($handle);

flock($handle, LOCK_UN);

fclose($handle);


/*
|--------------------------------------------------------------------------
| Success
|--------------------------------------------------------------------------
*/

respond(200, [
    'success' => true,
    'message' =>
        "You're on the list. We'll be in touch."
]);

?>