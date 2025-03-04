<?php
session_start();
if (!isset($_SESSION['username']) || $_SESSION['username'] !== 'admin') {
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

// Retrieve all users
$stmt = $pdo->query("SELECT id, username, original_username, created_at FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Retrieve all routines
$stmt = $pdo->query("SELECT r.id, r.user_id, r.routine_name, r.created_at, u.original_username 
                     FROM routines r 
                     JOIN users u ON r.user_id = u.id");
$routines = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Retrieve all logs
$stmt = $pdo->query("SELECT l.id, l.user_id, l.routine_id, l.log_data, l.created_at, u.original_username 
                     FROM logs l 
                     JOIN users u ON l.user_id = u.id");
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel - Logger App</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="assets/favicon.png" type="image/x-icon">
  <style>
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    table, th, td {
      border: 1px solid #ccc;
    }
    th, td {
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
    }
    .section {
      margin-bottom: 40px;
    }
    .actions a {
      margin-right: 10px;
      color: #007BFF;
      text-decoration: none;
    }
    .actions a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Admin Panel</h1>
    <p>Welcome, admin! <a href="logout.php">Logout</a> | <a href="dashboard.php">Back to Dashboard</a></p>
    
    <div class="section">
      <h2>Users</h2>
      <?php if (count($users) > 0): ?>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Original Username</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($users as $user): ?>
              <tr>
                <td><?php echo htmlspecialchars($user['id']); ?></td>
                <td><?php echo htmlspecialchars($user['username']); ?></td>
                <td><?php echo htmlspecialchars($user['original_username']); ?></td>
                <td><?php echo htmlspecialchars($user['created_at']); ?></td>
                <td class="actions">
                  <?php if ($user['username'] !== 'admin'): ?>
                    <a href="admin_delete_user.php?user_id=<?php echo $user['id']; ?>" onclick="return confirm('Delete this user?');">Delete</a>
                  <?php else: ?>
                    (admin)
                  <?php endif; ?>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php else: ?>
        <p>No users found.</p>
      <?php endif; ?>
    </div>
    
    <div class="section">
      <h2>Routines</h2>
      <?php if (count($routines) > 0): ?>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Routine Name</th>
              <th>User</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($routines as $routine): ?>
              <tr>
                <td><?php echo htmlspecialchars($routine['id']); ?></td>
                <td><?php echo htmlspecialchars($routine['routine_name']); ?></td>
                <td><?php echo htmlspecialchars($routine['original_username']); ?></td>
                <td><?php echo htmlspecialchars($routine['created_at']); ?></td>
                <td class="actions">
                  <a href="admin_delete_routine.php?routine_id=<?php echo $routine['id']; ?>" onclick="return confirm('Delete this routine?');">Delete</a>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php else: ?>
        <p>No routines found.</p>
      <?php endif; ?>
    </div>
    
    <div class="section">
      <h2>Logs</h2>
      <?php if (count($logs) > 0): ?>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Routine ID</th>
              <th>Log Data</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($logs as $log): ?>
              <tr>
                <td><?php echo htmlspecialchars($log['id']); ?></td>
                <td><?php echo htmlspecialchars($log['original_username']); ?></td>
                <td><?php echo htmlspecialchars($log['routine_id']); ?></td>
                <td><?php echo htmlspecialchars($log['log_data']); ?></td>
                <td><?php echo htmlspecialchars($log['created_at']); ?></td>
                <td class="actions">
                  <a href="admin_delete_log.php?log_id=<?php echo $log['id']; ?>" onclick="return confirm('Delete this log entry?');">Delete</a>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php else: ?>
        <p>No log entries found.</p>
      <?php endif; ?>
    </div>
    
  </div>
</body>
</html>
