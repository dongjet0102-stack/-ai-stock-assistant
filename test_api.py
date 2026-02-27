import urllib.request
import json

url = 'http://127.0.0.1:8000/api/analyze'
data = {'query': 'NVIDIA'}
data = json.dumps(data).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    response = urllib.request.urlopen(req)
    print("SUCCESS:")
    print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("OTHER ERROR:", e)
