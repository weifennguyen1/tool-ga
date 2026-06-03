## GA Tool

### Chạy web UI
```bash
npm start
```

### Cấu trúc dữ liệu (`assets/`)
| File | Mô tả |
|------|--------|
| `link.txt` | Link bài Facebook |
| `settings.json` | Khoảng số quay (min/max) |
| `facebook_comment_numbers.txt` | Số từ comment crawl |
| `ga-result.xlsx` | Lưu vết quay số |
| `www.facebook.com_DD-MM-YYYY.json` | Cookie — **tự chọn file ngày mới nhất** |
| `facebook-cookies.json` | Cookie import thủ công (nếu không có file dated) |

### CLI
```bash
node tool.js
node randome.js
```
