<?php
session_start();
require_once 'includes/config.php';

// If the user is already logged in, redirect accordingly.
if (isset($_SESSION['username'])) {
    if ($_SESSION['username'] === 'admin') {
        header("Location: admin.php");
    } else {
        header("Location: dashboard.php");
    }
    exit;
}

$error = "";

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Get and normalize the username input.
    $usernameInput = trim($_POST["username"]);
    $username = strtolower($usernameInput);
    $password = trim($_POST["password"]);
    
    // Connect to the database using PDO.
    try {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8", $dbUser, $dbPass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $e) {
        die("Database connection failed: " . $e->getMessage());
    }
    
    // Retrieve the user record based on the normalized username.
    $stmt = $pdo->prepare("SELECT id, username, password FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // If a user was found and the password matches, log them in.
    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['username'] = $username;
        // Redirect admin to admin.php, everyone else to dashboard.php
        if ($username === 'admin') {
            header("Location: admin.php");
        } else {
            header("Location: dashboard.php");
        }
        exit;
    } else {
        $error = "Invalid username or password.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>Logs - Login</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
  <link rel="apple-touch-icon" sizes="256x256" href="assets/icon_color.png">
</head>
<body>
  <div class="container">
    <img src="assets/logs_color_205.png" alt="Site Logo" class="logo">
    <h1>Logs</h1>
    <?php if ($error): ?>
      <p style="color:red;"><?php echo htmlspecialchars($error); ?></p>
    <?php endif; ?>
    <form action="index.php" method="post">
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required placeholder="Enter your username">
      
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required placeholder="Enter your password">
      
      <button type="submit">Login</button>
    </form>

    <form action="register.php" method="get">
      <button class="button-alt" type="submit">Create new account</button>
    </form>
    <p>&copy 2025 Dan Ledwith</p>
  </div>
</body>
</html>
