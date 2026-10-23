import subprocess
r = subprocess.run(['tasklist'], capture_output=True, text=True)
for line in r.stdout.splitlines():
    l = line.lower()
    if 'electron' in l or 'node' in l:
        parts = line.split()
        if len(parts) >= 6:
            mem = parts[5].replace(',','').replace('K','')
            try:
                m = int(mem)
                flag = ' <<< ELECTRON MAIN' if m > 50000 and 'electron' not in l else ''
                if m > 5000 or 'electron' in l:
                    print(f"{parts[0]:20} PID {parts[1]:6} {m:>8} KB{flag}")
            except: pass
print('done')
