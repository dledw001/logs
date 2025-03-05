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
$stmt = $pdo->prepare("SELECT id, routine_name FROM routines WHERE user_id = ? ORDER BY created_at DESC");
$stmt->execute([$userId]);
$routines = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard - Logs</title>
  <!-- Bootstrap CSS -->
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
  <!-- Optional: Your custom styles -->
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body class="bg-dark text-light">
  <div class="container mt-5">
    <div class="card shadow">
      <div class="card-header">
        <h1 class="card-title mb-0">Dashboard</h1>
      </div>
      <div class="card-body">
        <p>Welcome, <strong><?php echo htmlspecialchars($originalUsername); ?></strong>! 
          <a href="settings.php" class="btn btn-sm btn-secondary">Settings</a>
          <a href="logout.php" class="btn btn-sm btn-danger">Logout</a>
        </p>
        
        <h2 class="h4">Create New Routine</h2>
        <?php if ($message): ?>
          <div class="alert alert-info"><?php echo htmlspecialchars($message); ?></div>
        <?php endif; ?>
        <form action="dashboard.php" method="post" class="mb-4">
          <div class="form-group">
            <label for="routine_name">Routine Name:</label>
            <input type="text" id="routine_name" name="routine_name" class="form-control" placeholder="Enter routine name" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Create Routine</button>
        </form>
        
        <h2 class="h4">Your Routines</h2>
        <?php if (count($routines) > 0): ?>
          <div class="list-group">
            <?php foreach ($routines as $routine): ?>
              <a href="routine_detail.php?routine_id=<?php echo $routine['id']; ?>" class="list-group-item list-group-item-action">
                <?php echo htmlspecialchars($routine['routine_name']); ?>
              </a>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <p>You have not created any routines yet.</p>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <!-- Bootstrap JS, Popper.js, and jQuery -->
  <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>
  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
</body>
</html>
