<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: index.php");
    exit;
}

require_once 'includes/config.php';

try {
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8", $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

// Get user details (ID and original_username) based on session username.
$username = $_SESSION['username'];
$stmt = $pdo->prepare("SELECT id, original_username FROM users WHERE username = ?");
$stmt->execute([$username]);
$userRecord = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$userRecord) {
    die("User not found.");
}
$userId = $userRecord['id'];
$originalUsername = $userRecord['original_username'];

$message = "";
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['routine_name'])) {
    $routineName = trim($_POST['routine_name']);
    if (empty($routineName)) {
        $message = "Please enter a routine name.";
    } else {
        $stmt = $pdo->prepare("INSERT INTO routines (user_id, routine_name) VALUES (?, ?)");
        if ($stmt->execute([$userId, $routineName])) {
            // Get the new routine ID and redirect immediately to routine_detail.php.
            $newRoutineId = $pdo->lastInsertId();
            header("Location: routine_detail.php?routine_id=" . $newRoutineId);
            exit;
        } else {
            $message = "Error creating routine. Please try again.";
        }
    }
}

// Retrieve routines belonging to this user.
$stmt = $pdo->prepare("SELECT id, routine_name, created_at FROM routines WHERE user_id = ? ORDER BY created_at DESC");
$stmt->execute([$userId]);
$routines = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Logs</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body>
  <div class="container">
    <h1>Dashboard</h1>
    <p>Welcome, <?php echo htmlspecialchars($originalUsername); ?>! 
      <a href="logout.php">Logout</a>
    </p>
    
    <h2>Create New Routine</h2>
    <?php if ($message): ?>
      <p><?php echo htmlspecialchars($message); ?></p>
    <?php endif; ?>
    <form action="dashboard.php" method="post">
      <label for="routine_name">Routine Name:</label>
      <input type="text" id="routine_name" name="routine_name" placeholder="Enter routine name" required>
      <button type="submit">Create Routine</button>
    </form>
    
    <h2>Your Routines</h2>
    <?php if (count($routines) > 0): ?>
      <ul>
        <?php foreach ($routines as $routine): ?>
          <li>
            <?php echo htmlspecialchars($routine['routine_name']); ?>
            <small>(Created on: <?php echo htmlspecialchars($routine['created_at']); ?>)</small>
            <!-- View Details Link -->
            <a href="routine_detail.php?routine_id=<?php echo $routine['id']; ?>">View</a>
            <!-- Log Entry Link -->
            <a href="log_values.php?routine_id=<?php echo $routine['id']; ?>">Log Entry</a>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php else: ?>
      <p>You have not created any routines yet.</p>
    <?php endif; ?>
  </div>
</body>
</html>
