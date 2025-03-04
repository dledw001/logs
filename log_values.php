<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: index.php");
    exit;
}

require_once 'includes/config.php';

// Establish database connection.
try {
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8", $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

// Ensure a routine_id is provided.
if (!isset($_GET['routine_id'])) {
    die("Routine not specified.");
}
$routine_id = intval($_GET['routine_id']);

// Verify that the routine belongs to the logged-in user.
$username = $_SESSION['username'];
$stmt = $pdo->prepare("SELECT r.id, r.routine_name, u.id AS user_id 
                       FROM routines r 
                       JOIN users u ON r.user_id = u.id 
                       WHERE r.id = ? AND u.username = ?");
$stmt->execute([$routine_id, $username]);
$routine = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$routine) {
    die("Routine not found or access denied.");
}
$user_id = $routine['user_id'];

$message = "";
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect metric values from the form.
    // Each metric input should be named "metric_{metric_id}"
    $metricValues = [];
    foreach ($_POST as $key => $value) {
        if (strpos($key, 'metric_') === 0) {
            $metricId = substr($key, 7); // get part after "metric_"
            $metricValues[$metricId] = trim($value);
        }
    }
    
    // Insert a new log entry.
    $stmt = $pdo->prepare("INSERT INTO log_entries (user_id, routine_id, metric_values) VALUES (?, ?, ?)");
    if ($stmt->execute([$user_id, $routine_id, json_encode($metricValues)])) {
        $message = "Log entry recorded successfully!";
    } else {
        $message = "Error recording log entry. Please try again.";
    }
}

// Retrieve top-level metrics (metrics not associated with any element).
$stmt = $pdo->prepare("SELECT id, metric_name FROM metrics WHERE routine_id = ? AND element_id IS NULL ORDER BY id ASC");
$stmt->execute([$routine_id]);
$topMetrics = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Retrieve elements for this routine.
$stmt = $pdo->prepare("SELECT id, element_name FROM elements WHERE routine_id = ? ORDER BY id ASC");
$stmt->execute([$routine_id]);
$elements = $stmt->fetchAll(PDO::FETCH_ASSOC);

// For each element, retrieve its metrics.
$elementMetrics = [];
foreach ($elements as $element) {
    $stmt = $pdo->prepare("SELECT id, metric_name FROM metrics WHERE routine_id = ? AND element_id = ? ORDER BY id ASC");
    $stmt->execute([$routine_id, $element['id']]);
    $elementMetrics[$element['id']] = $stmt->fetchAll(PDO::FETCH_ASSOC);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log Values for <?php echo htmlspecialchars($routine['routine_name']); ?> - Logs</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body>
  <div class="container">
    <h1>Log Values for Routine: <?php echo htmlspecialchars($routine['routine_name']); ?></h1>
    <?php if ($message): ?>
      <p><?php echo htmlspecialchars($message); ?></p>
    <?php endif; ?>
    <form action="log_values.php?routine_id=<?php echo $routine_id; ?>" method="post">
      <h2>Top-Level Metrics</h2>
      <?php if (count($topMetrics) > 0): ?>
        <?php foreach ($topMetrics as $metric): ?>
          <label for="metric_<?php echo $metric['id']; ?>"><?php echo htmlspecialchars($metric['metric_name']); ?>:</label>
          <input type="text" id="metric_<?php echo $metric['id']; ?>" name="metric_<?php echo $metric['id']; ?>" placeholder="Enter value">
        <?php endforeach; ?>
      <?php else: ?>
        <p>No top-level metrics defined for this routine.</p>
      <?php endif; ?>

      <?php if (count($elements) > 0): ?>
        <?php foreach ($elements as $element): ?>
          <h2><?php echo htmlspecialchars($element['element_name']); ?></h2>
          <?php if (!empty($elementMetrics[$element['id']])): ?>
            <?php foreach ($elementMetrics[$element['id']] as $metric): ?>
              <label for="metric_<?php echo $metric['id']; ?>"><?php echo htmlspecialchars($metric['metric_name']); ?>:</label>
              <input type="text" id="metric_<?php echo $metric['id']; ?>" name="metric_<?php echo $metric['id']; ?>" placeholder="Enter value">
            <?php endforeach; ?>
          <?php else: ?>
            <p>No metrics defined under this element.</p>
          <?php endif; ?>
        <?php endforeach; ?>
      <?php endif; ?>
      
      <button type="submit">Submit Log Entry</button>
    </form>
    <p><a href="dashboard.php">Back to Dashboard</a></p>
  </div>
</body>
</html>
