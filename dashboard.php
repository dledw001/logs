<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: index.php");
    exit;
}
$username = $_SESSION['username'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logs - Dashboard</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body>
  <div class="container">
    <h1>Dashboard</h1>
    <p>Welcome, <?php echo htmlspecialchars($username); ?>!</p>
    <!-- Logout Button -->
    <form action="logout.php" method="post">
      <button type="submit">Logout</button>
    </form>
  </div>
</body>
</html>
