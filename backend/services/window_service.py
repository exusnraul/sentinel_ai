import subprocess

def get_active_window_mac():
    try:
        script = 'tell application "System Events" to get name of first application process whose frontmost is true'
        result = subprocess.check_output(['osascript', '-e', script], stderr=subprocess.STDOUT)
        return result.decode('utf-8').strip()
    except Exception as e:
        print(f"Error getting active window: {e}")
        return "Unknown"

# You could expand this for Windows later:
def get_active_window():
    import sys
    if sys.platform == "darwin":
        return get_active_window_mac()
    return "Unknown"
