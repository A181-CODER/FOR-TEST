// دالة للتأكد من بصمة ملف الأسئلة
// Rust يضمن عدم وجود Memory Leaks هنا مما يزيد الأمان
pub fn verify_exam_hash(exam_data: &str, stored_hash: &str) -> bool {
    let calculated_hash = sha256::digest(exam_data);
    if calculated_hash == stored_hash {
        return true;
    } else {
        println!("SECURITY ALERT: Exam Data Tampered!");
        return false;
    }
}

fn main() {
    println!("UniGuard Security Module Active...");
}