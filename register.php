<?php
session_start();
require_once 'includes/config.php';

// If the user is already logged in, redirect them to the dashboard.
if (isset($_SESSION['username'])) {
    header("Location: dashboard.php");
    exit;
}

$error = "";
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Retrieve and sanitize form data.
    $usernameInput = trim($_POST["username"]);
    $username = strtolower($usernameInput);
    $password = trim($_POST["password"]);

    try {
        // Establish a database connection using PDO.
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8", $dbUser, $dbPass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $e) {
        die("Database connection failed: " . $e->getMessage());
    }

    // Check if the username already exists.
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        $error = "Username already exists.";
    } else {
        // Hash the password.
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        // Insert the new user.
        $stmt = $pdo->prepare("INSERT INTO users (username, original_username, password) VALUES (?, ?, ?)");
        if ($stmt->execute([$username, $usernameInput, $passwordHash])) {
            // Registration successful: store username in session and redirect.
            $_SESSION['username'] = $username;
            header("Location: dashboard.php");
            exit;
        } else {
            $error = "Registration failed. Please try again.";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logs - Register</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body>
  <div class="container">
    <img src="assets/logs_color_cropped_256.png" alt="Site Logo" class="logo">
    <h1>Register</h1>
    <?php if ($error): ?>
      <p style="color:red;"><?php echo htmlspecialchars($error); ?></p>
    <?php endif; ?>
    <form action="register.php" method="post">
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required placeholder="Enter your username">
      
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required placeholder="Enter your password">
      
      <button type="submit">Register</button>
    </form>
    <a href="index.php">Already have an account? Login</a>
  </div>
</body>
</html>
