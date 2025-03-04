<?php
// Start the session
header("Content-Type: text/html; charset=UTF-8");
session_start();

// If the user is already logged in, redirect to dashboard
if (isset($_SESSION['username'])) {
    header("Location: dashboard.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logger App - Login</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body>
  <div class="container">
    <img src="assets/logs_color_256.png" alt="Site Logo" class="logo">
    <h1>Logger App</h1>
    <form action="login.php" method="post">
      <label for="username">Username:</label>
      <input type="text" id="username" name="username" required placeholder="Enter your username">
      
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required placeholder="Enter your password">
      
      <button type="submit">Login</button>
    </form>
    <a href="register.php">Don't have an account? Register</a>
  </div>
</body>
</html>
