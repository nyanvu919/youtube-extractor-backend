// ============================================
// 0. CẤU HÌNH HỆ THỐNG
// ============================================
const BACKEND_URL = "https://yt-api-proxy.nyaochen9.workers.dev";

// Lấy các phần tử HTML
const youtubeUrlInput = document.getElementById('youtubeUrl');
const apiKeyInput = document.getElementById('apiKey');
const getInfoBtn = document.getElementById('getInfoBtn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');

// Biến toàn cục lưu dữ liệu
let fullVideoData = null;
let currentAuthAction = 'login';

// ============================================
// 1. HÀM XỬ LÝ AUTH (ĐĂNG NHẬP / ĐĂNG KÝ / HIỂN THỊ)
// ============================================

function showAuthModal(action) {
    currentAuthAction = action;
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
        modalTitle.innerText = action === 'login' ? 'Đăng nhập' : 'Đăng ký';
    }
    document.getElementById('auth-modal').style.display = 'flex';
}

async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit-btn');

    if (!email || !password) {
        alert("Vui lòng nhập đủ email và mật khẩu");
        return;
    }

    btn.innerText = "Đang xử lý...";
    btn.disabled = true;

    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/${currentAuthAction}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            if (currentAuthAction === 'login') {
                localStorage.setItem('access_token', data.access_token);
                // LƯU EMAIL CHÍNH XÁC VÀO BỘ NHỚ
                localStorage.setItem('user_email', data.user.email);
                alert("Đăng nhập thành công!");
                location.reload();
            } else {
                alert('Đăng ký thành công! Hãy kiểm tra email để xác thực (nếu có), sau đó quay lại đăng nhập.');
                showAuthModal('login');
            }
        } else {
            alert("Lỗi: " + (data.msg || data.error_description || "Thông tin không chính xác"));
        }
    } catch (err) {
        alert("Lỗi kết nối Server: " + err.message);
    } finally {
        btn.innerText = "Xác nhận";
        btn.disabled = false;
    }
}

function checkLogin() {
    // Xử lý xác thực từ URL khi nhấn link trong mail
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const token = params.get("access_token");
        if (token) {
            localStorage.setItem('access_token', token);
            // Sau khi có token từ mail, có thể cần login lại hoặc gọi api lấy mail
            localStorage.setItem('user_email', "Thành viên đã xác thực");
            window.history.replaceState(null, null, window.location.pathname);
        }
    }

    const token = localStorage.getItem('access_token');
    const email = localStorage.getItem('user_email');
    
    const loggedInDiv = document.getElementById('user-logged-in');
    const loggedOutDiv = document.getElementById('user-logged-out');
    const emailSpan = document.getElementById('user-email');

    if (token) {
        if (loggedInDiv) loggedInDiv.style.display = 'flex';
        if (loggedOutDiv) loggedOutDiv.style.display = 'none';
        // HIỂN THỊ EMAIL LÊN NÚT
        if (emailSpan) {
            emailSpan.innerText = (email && email !== "null") ? email : "Đã đăng nhập";
        }
    } else {
        if (loggedInDiv) loggedInDiv.style.display = 'none';
        if (loggedOutDiv) loggedOutDiv.style.display = 'flex';
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    location.reload();
}

// ============================================
// 2. HÀM GỌI DỮ LIỆU TỪ BACKEND (CÓ CHẶN 3 LẦN)
// ============================================

async function fetchAllVideoInfo(youtubeUrl, apiKey) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập để sử dụng!');
        showAuthModal('login');
        throw new Error('AUTH_REQUIRED');
    }

    const response = await fetch(`${BACKEND_URL}/api/youtube/getVideoInfo`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ youtubeUrl, userApiKey: apiKey })
    });

    // Nếu Backend báo hết lượt (402)
    if (response.status === 402) {
        showPricingModal();
        throw new Error('LIMIT_REACHED');
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `Lỗi: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
        throw new Error('Video không tồn tại hoặc không truy cập được');
    }
    return data.items[0];
}

function showPricingModal() {
    // Xóa modal cũ nếu có để tránh trùng lặp
    const oldModal = document.getElementById('paywall-modal');
    if (oldModal) oldModal.remove();

    const paywallHtml = `
        <div id="paywall-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:sans-serif;">
            <div style="background:white;padding:40px;border-radius:20px;max-width:500px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <h2 style="color:#ff0000;font-size:28px;">💎 Hết lượt dùng miễn phí</h2>
                <p style="font-size:18px;color:#555;">Bạn đã sử dụng hết 3 lượt tra cứu miễn phí. Vui lòng nâng cấp để tiếp tục tra cứu không giới hạn.</p>
                <div style="display:flex;gap:15px;margin-top:30px;">
                    <div style="flex:1;border:1px solid #ddd;padding:20px;border-radius:15px;">
                        <h3>Gói Tháng</h3>
                        <p style="font-size:22px;font-weight:bold;color:#ff0000;">50.000đ</p>
                        <button onclick="window.open('https://momo.vn','_blank')" style="background:#333;color:white;border:none;padding:10px;width:100%;border-radius:5px;cursor:pointer;">MUA NGAY</button>
                    </div>
                    <div style="flex:1;border:2px solid #ff0000;padding:20px;border-radius:15px;position:relative;">
                        <span style="position:absolute;top:-10px;right:10px;background:#ff0000;color:white;font-size:10px;padding:2px 5px;border-radius:5px;">BEST</span>
                        <h3>Gói Năm</h3>
                        <p style="font-size:22px;font-weight:bold;color:#ff0000;">550.000đ</p>
                        <button onclick="window.open('https://momo.vn','_blank')" style="background:#333;color:white;border:none;padding:10px;width:100%;border-radius:5px;cursor:pointer;">MUA NGAY</button>
                    </div>
                </div>
                <button onclick="location.reload()" style="margin-top:20px;background:none;border:none;color:#999;text-decoration:underline;cursor:pointer;">Quay lại sau</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', paywallHtml);
}

// ============================================
// 3. TIỆN ÍCH & PHÂN TÍCH (GIỮ NGUYÊN LOGIC GỐC)
// ============================================

function extractVideoId(url) {
    const patterns = [/(?:v=|\/)([a-zA-Z0-9_-]{11})/, /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function formatDate(isoDate) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(isoDate).toLocaleDateString('vi-VN', options);
}

function formatNumber(num) {
    if (!num) return '0';
    const number = parseInt(num);
    if (number >= 1000000) return (number / 1000000).toFixed(1) + ' triệu';
    if (number >= 1000) return (number / 1000).toFixed(1) + ' nghìn';
    return number.toLocaleString('vi-VN');
}

function formatDuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let result = [];
    if (match[1]) result.push(`${match[1]} giờ`);
    if (match[2]) result.push(`${match[2]} phút`);
    if (match[3]) result.push(`${match[3]} giây`);
    return result.join(' ') || '0 giây';
}

function calculatePopularityScore(views, likes, comments, daysOld) {
    if (daysOld === 0) daysOld = 1;
    return Math.round(((views / daysOld) * 0.7 + ((likes + comments) / views * 100) * 0.3) * 100) / 100;
}

// Hàm phân tích dữ liệu video
function analyzeVideoData(videoData, categoryName) {
    const snippet = videoData.snippet || {};
    const stats = videoData.statistics || {};
    const content = videoData.contentDetails || {};
    
    const publishedDate = new Date(snippet.publishedAt);
    const diffDays = Math.ceil(Math.abs(new Date() - publishedDate) / (1000 * 60 * 60 * 24));
    
    const viewCount = parseInt(stats.viewCount || 0);
    const likeCount = parseInt(stats.likeCount || 0);
    const commentCount = parseInt(stats.commentCount || 0);
    
    return {
        basic: {
            title: snippet.title, videoId: videoData.id,
            channelTitle: snippet.channelTitle,
            publishedAtFormatted: formatDate(snippet.publishedAt),
            thumbnails: snippet.thumbnails,
            description: snippet.description
        },
        statistics: {
            viewCount: formatNumber(stats.viewCount), viewCountRaw: viewCount,
            likeCount: formatNumber(stats.likeCount), commentCount: formatNumber(stats.commentCount)
        },
        contentDetails: {
            durationFormatted: formatDuration(content.duration),
            definition: content.definition.toUpperCase(),
            caption: content.caption === 'true' ? 'Có' : 'Không'
        },
        analysis: {
            age: { daysOld: diffDays },
            engagement: { 
                engagementRate: viewCount > 0 ? ((likeCount + commentCount) / viewCount * 100).toFixed(2) + '%' : '0%',
                popularityScore: calculatePopularityScore(viewCount, likeCount, commentCount, diffDays)
            },
            seo: { titleLength: snippet.title.length, tagCount: (snippet.tags || []).length }
        }
    };
}

// ============================================
// 4. GIAO DIỆN HIỂN THỊ (TABS)
// ============================================

function createTabInterface(videoInfo) {
    return `
        <div class="tabs-container">
            <div class="tabs-header" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <button class="tab-btn active" data-tab="overview">Tổng quan</button>
                <button class="tab-btn" data-tab="details">Chi tiết</button>
                <button class="tab-btn" data-tab="stats">Thống kê</button>
                <button class="tab-btn" data-tab="raw">Dữ liệu gốc</button>
            </div>
            <div class="tabs-content">
                <div class="tab-pane active" id="overview-tab">
                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:20px;">
                        <img src="${videoInfo.basic.thumbnails.high.url}" style="width:100%; border-radius:10px;">
                        <div>
                            <h2>${videoInfo.basic.title}</h2>
                            <p><b>Kênh:</b> ${videoInfo.basic.channelTitle}</p>
                            <p><b>Ngày đăng:</b> ${videoInfo.basic.publishedAtFormatted} (${videoInfo.analysis.age.daysOld} ngày trước)</p>
                            <p><b>Thời lượng:</b> ${videoInfo.contentDetails.durationFormatted}</p>
                            <div style="display:flex; gap:10px; margin-top:10px;">
                                <span style="background:#e7f3ff; padding:5px 10px; border-radius:5px;">👁️ ${videoInfo.statistics.viewCount}</span>
                                <span style="background:#f6ffed; padding:5px 10px; border-radius:5px;">👍 ${videoInfo.statistics.likeCount}</span>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:20px; background:#f9f9f9; padding:15px; border-radius:10px;">
                        <h4>Mô tả video:</h4>
                        <p style="white-space:pre-wrap; font-size:14px; color:#555;">${videoInfo.basic.description}</p>
                    </div>
                </div>
                <div class="tab-pane" id="details-tab" style="display:none;">
                    <table style="width:100%; border-collapse:collapse;">
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Chất lượng:</td><td><b>${videoInfo.contentDetails.definition}</b></td></tr>
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Phụ đề:</td><td>${videoInfo.contentDetails.caption}</td></tr>
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Độ dài tiêu đề:</td><td>${videoInfo.analysis.seo.titleLength} ký tự</td></tr>
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Số lượng Tags:</td><td>${videoInfo.analysis.seo.tagCount}</td></tr>
                    </table>
                </div>
                <div class="tab-pane" id="stats-tab" style="display:none;">
                    <h3>Phân tích tương tác</h3>
                    <p>Tỷ lệ tương tác: <b>${videoInfo.analysis.engagement.engagementRate}</b></p>
                    <p>Điểm phổ biến: <b>${videoInfo.analysis.engagement.popularityScore}</b></p>
                </div>
                <div class="tab-pane" id="raw-tab" style="display:none;">
                    <pre style="background:#222; color:#0f0; padding:15px; border-radius:5px; overflow:auto; max-height:400px;">${JSON.stringify(fullVideoData, null, 2)}</pre>
                </div>
            </div>
        </div>
    `;
}

function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => { b.classList.remove('active'); b.style.background="none"; b.style.color="#333"; });
            panes.forEach(p => p.style.display = 'none');
            btn.classList.add('active');
            btn.style.background = "#ff0000";
            btn.style.color = "white";
            document.getElementById(`${btn.dataset.tab}-tab`).style.display = 'block';
        });
    });
}

// ============================================
// 5. LUỒNG CHÍNH (KHI NHẤN NÚT LẤY THÔNG TIN)
// ============================================

async function getFullVideoInfo() {
    const youtubeUrl = youtubeUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    if (!youtubeUrl || !apiKey) {
        alert('📝 Vui lòng dán URL YouTube và nhập API Key');
        return;
    }
    
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
        alert('❌ URL YouTube không hợp lệ');
        return;
    }
    
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    
    try {
        // GỌI BACKEND ĐỂ LẤY DỮ LIỆU (BACKEND ĐÃ XỬ LÝ ĐẾM LƯỢT THEO USER)
        const videoData = await fetchAllVideoInfo(youtubeUrl, apiKey);
        fullVideoData = videoData;
        
        // Phân tích
        const analyzedData = analyzeVideoData(videoData, "Video");
        
        // Hiển thị
        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = createTabInterface(analyzedData);
        resultDiv.style.display = 'block';
        
        setTimeout(initTabs, 100);
        
    } catch (error) {
        loadingDiv.style.display = 'none';
        if (error.message !== 'AUTH_REQUIRED' && error.message !== 'LIMIT_REACHED') {
            alert('Lỗi: ' + error.message);
        }
    }
}

// ============================================
// 6. KHỞI TẠO KHI TẢI TRANG
// ============================================

getInfoBtn.addEventListener('click', getFullVideoInfo);

window.addEventListener('load', () => {
    checkLogin();
    const savedKey = localStorage.getItem('youtube_api_key');
    if (savedKey) apiKeyInput.value = savedKey;
});

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('youtube_api_key', apiKeyInput.value.trim());
});
