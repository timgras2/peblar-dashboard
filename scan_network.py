import socket
import concurrent.futures

def check_ip(ip, port):
    try:
        with socket.create_connection((ip, port), timeout=0.5):
            return (ip, port)
    except:
        return None

base_ip = "192.168.1."
ips = [base_ip + str(i) for i in range(1, 255)]
ports = [80, 8080, 443]

print(f"Scanning {base_ip}0/24 on ports {ports}...")

with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
    futures = []
    for ip in ips:
        for port in ports:
            futures.append(executor.submit(check_ip, ip, port))
    
    for future in concurrent.futures.as_completed(futures):
        result = future.result()
        if result:
            print(f"Found open port: {result[0]}:{result[1]}")
