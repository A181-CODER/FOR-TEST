<?php
// استقبال بيانات الغش من البايثون وتخزينها
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $studentId = $data['student_id'];
    $cheatType = $data['violation'];
    
    // الاتصال بقاعدة البيانات
    $conn = new mysqli("localhost", "root", "", "uniguard_db");
    
    // تسجيل الحالة
    $stmt = $conn->prepare("INSERT INTO cheating_logs (student_id, violation_type) VALUES (?, ?)");
    $stmt->bind_param("is", $studentId, $cheatType);
    $stmt->execute();
    
    echo json_encode(["status" => "logged"]);
} else {
    echo json_encode(["message" => "UniGuard API Running"]);
}
?>