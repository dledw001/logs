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

// Make sure a routine ID is provided.
if (!isset($_GET['routine_id'])) {
    die("Routine not specified.");
}
$routine_id = intval($_GET['routine_id']);

// Verify that the routine belongs to the logged-in user.
$username = $_SESSION['username'];
$stmt = $pdo->prepare("SELECT r.id, r.routine_name, u.id as user_id, u.original_username 
                       FROM routines r 
                       JOIN users u ON r.user_id = u.id 
                       WHERE r.id = ? AND u.username = ?");
$stmt->execute([$routine_id, $username]);
$routine = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$routine) {
    die("Routine not found or access denied.");
}

// Message for feedback
$message = "";

// Process form submissions
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Adding a new element
    if (isset($_POST['new_element_name'])) {
        $new_element_name = trim($_POST['new_element_name']);
        if (!empty($new_element_name)) {
            $stmt = $pdo->prepare("INSERT INTO elements (routine_id, element_name) VALUES (?, ?)");
            if ($stmt->execute([$routine_id, $new_element_name])) {
                $message = "Element added successfully!";
            } else {
                $message = "Error adding element.";
            }
        }
    }
    
    // Adding a new metric
    if (isset($_POST['new_metric_name']) && isset($_POST['element_id'])) {
        $new_metric_name = trim($_POST['new_metric_name']);
        $element_id = $_POST['element_id']; // "0" indicates a top-level metric
        if (!empty($new_metric_name)) {
            if ($element_id === "0") {
                // Top-level metric (no element)
                $stmt = $pdo->prepare("INSERT INTO metrics (routine_id, element_id, metric_name) VALUES (?, NULL, ?)");
                if ($stmt->execute([$routine_id, $new_metric_name])) {
                    $message = "Metric added successfully!";
                } else {
                    $message = "Error adding metric.";
                }
            } else {
                // Metric for a specific element; ensure element_id is integer.
                $element_id = intval($element_id);
                $stmt = $pdo->prepare("INSERT INTO metrics (routine_id, element_id, metric_name) VALUES (?, ?, ?)");
                if ($stmt->execute([$routine_id, $element_id, $new_metric_name])) {
                    $message = "Metric added to element successfully!";
                } else {
                    $message = "Error adding metric to element.";
                }
            }
        }
    }
}

// Retrieve top-level metrics for this routine (those with element_id IS NULL)
$stmt = $pdo->prepare("SELECT id, metric_name, created_at FROM metrics WHERE routine_id = ? AND element_id IS NULL ORDER BY created_at ASC");
$stmt->execute([$routine_id]);
$topMetrics = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Retrieve elements for this routine
$stmt = $pdo->prepare("SELECT id, element_name, created_at FROM elements WHERE routine_id = ? ORDER BY created_at ASC");
$stmt->execute([$routine_id]);
$elements = $stmt->fetchAll(PDO::FETCH_ASSOC);

//Retrieve logs for this routine
$stmt = $pdo->prepare("SELECT * FROM log_entries WHERE routine_id = ? ORDER BY created_at DESC");
$stmt->execute([$routine_id]);
$log_entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

// For each element, retrieve its metrics
$elementMetrics = [];
foreach ($elements as $element) {
    $stmt = $pdo->prepare("SELECT id, metric_name, created_at FROM metrics WHERE routine_id = ? AND element_id = ? ORDER BY created_at ASC");
    $stmt->execute([$routine_id, $element['id']]);
    $elementMetrics[$element['id']] = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Routine Details - Logs</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
</head>
<body>
  <div class="container">
    <h1><?php echo htmlspecialchars($routine['routine_name']); ?></h1>
    <?php if ($message): ?>
      <p><?php echo htmlspecialchars($message); ?></p>
    <?php endif; ?>

    <h2>Add New Element</h2>
    <form action="routine_detail.php?routine_id=<?php echo $routine_id; ?>" method="post">
      <label for="new_element_name">Element Name:</label>
      <input type="text" id="new_element_name" name="new_element_name" placeholder="Enter element name" required>
      <button type="submit">Add Element</button>
    </form>

    <h2>Add New Metric</h2>
    <!-- Form for adding a top-level metric -->
    <form action="routine_detail.php?routine_id=<?php echo $routine_id; ?>" method="post">
      <label for="new_metric_name_top">Metric Name:</label>
      <input type="text" id="new_metric_name_top" name="new_metric_name" placeholder="Enter metric name" required>
      <!-- element_id "0" indicates top-level metric -->
      <input type="hidden" name="element_id" value="0">
      <button type="submit">Add Top-Level Metric</button>
    </form>

    <?php if (count($topMetrics) > 0): ?>
      <h3>Top-Level Metrics</h3>
      <ul>
        <?php foreach ($topMetrics as $metric): ?>
          <li><?php echo htmlspecialchars($metric['metric_name']); ?> (added on <?php echo htmlspecialchars($metric['created_at']); ?>)</li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>

    <h2>Elements & Metrics</h2>
    <?php if (count($elements) > 0): ?>
      <?php foreach ($elements as $element): ?>
        <div style="border:1px solid #ccc; padding:10px; margin-bottom:20px;">
          <h3><?php echo htmlspecialchars($element['element_name']); ?></h3>
          <!-- Form to add a metric under this element -->
          <form action="routine_detail.php?routine_id=<?php echo $routine_id; ?>" method="post">
            <label for="metric_<?php echo $element['id']; ?>">Metric Name:</label>
            <input type="text" id="metric_<?php echo $element['id']; ?>" name="new_metric_name" placeholder="Enter metric name" required>
            <input type="hidden" name="element_id" value="<?php echo $element['id']; ?>">
            <button type="submit">Add Metric to <?php echo htmlspecialchars($element['element_name']); ?></button>
          </form>
          <?php if (!empty($elementMetrics[$element['id']])): ?>
            <ul>
              <?php foreach ($elementMetrics[$element['id']] as $metric): ?>
                <li><?php echo htmlspecialchars($metric['metric_name']); ?> (added on <?php echo htmlspecialchars($metric['created_at']); ?>)</li>
              <?php endforeach; ?>
            </ul>
          <?php else: ?>
            <p>No metrics added to this element yet.</p>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php else: ?>
      <p>No elements created yet.</p>
    <?php endif; ?>

    <p><a href="dashboard.php">Back to Dashboard</a></p>
  </div>
</body>
</html>
