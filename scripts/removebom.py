# create a file remove_bom.py
with open('send-notification-from-html.js', 'rb') as f:
    content = f.read()

# Xóa BOM nếu có
if content.startswith(b'\xef\xbb\xbf'):
    content = content[3:]

with open('send-notification-from-html.js', 'wb') as f:
    f.write(content)

print('✅ Đã xóa BOM thành công!')