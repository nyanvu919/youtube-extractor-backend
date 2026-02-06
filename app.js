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
let selectedPlan = null;

// ============================================
// 1. HÀM XỬ LÝ AUTH (ĐĂNG NHẬP / ĐĂNG KÝ)
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
                localStorage.setItem('user_email', data.user.email);
                alert("Đăng nhập thành công!");
                location.reload();
            } else {
                alert('Đăng ký thành công! Hãy kiểm tra email (nếu có) rồi đăng nhập.');
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
    // Xử lý xác thực từ URL
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const token = params.get("access_token");
        if (token) {
            localStorage.setItem('access_token', token);
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
// 2. HÀM THANH TOÁN (PAYWALL & QR CODE)
// ============================================

function showPricingModal() {
    const oldModal = document.getElementById('paywall-modal');
    if (oldModal) oldModal.remove();

    const paywallHtml = `
        <div id="paywall-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:sans-serif;">
            <!-- BƯỚC 1: CHỌN GÓI -->
            <div id="payment-step-1" style="background:white;padding:30px;border-radius:20px;max-width:500px;width:90%;text-align:center;animation: fadeIn 0.3s;">
                <h2 style="color:#ff0000;margin-bottom:10px;">💎 Nâng cấp tài khoản</h2>
                <p style="color:#666;">Chọn gói phù hợp để tiếp tục tra cứu không giới hạn</p>
                <div style="display:flex;gap:15px;margin-top:25px;">
                    <div style="flex:1;border:1px solid #ddd;padding:20px;border-radius:15px;cursor:pointer;transition:0.3s;" onclick="goToStep2('Gói Tháng', 50000)">
                        <h3 style="margin-bottom:5px;">Gói Tháng</h3>
                        <p style="font-size:22px;font-weight:bold;color:#ff0000;margin:10px 0;">50.000đ</p>
                        <button style="width:100%;padding:10px;background:#333;color:white;border:none;border-radius:5px;cursor:pointer;">MUA NGAY</button>
                    </div>
                    <div style="flex:1;border:2px solid #ff0000;padding:20px;border-radius:15px;cursor:pointer;position:relative;" onclick="goToStep2('Gói Năm', 550000)">
                        <span style="position:absolute;top:-12px;right:10px;background:#ff0000;color:white;font-size:11px;padding:3px 8px;border-radius:5px;font-weight:bold;">TIẾT KIỆM</span>
                        <h3 style="margin-bottom:5px;">Gói Năm</h3>
                        <p style="font-size:22px;font-weight:bold;color:#ff0000;margin:10px 0;">550.000đ</p>
                        <button style="width:100%;padding:10px;background:#ff0000;color:white;border:none;border-radius:5px;cursor:pointer;">MUA NGAY</button>
                    </div>
                </div>
                <button onclick="document.getElementById('paywall-modal').remove()" style="margin-top:20px;background:none;border:none;color:#999;text-decoration:underline;cursor:pointer;">Quay lại sau</button>
            </div>

            <!-- BƯỚC 2: ĐIỀN THÔNG TIN -->
            <div id="payment-step-2" style="display:none; background:white;padding:35px;border-radius:20px;max-width:400px;width:90%;animation: fadeIn 0.3s;">
                <h3 style="text-align:center;margin-bottom:10px;">Thông tin xác nhận</h3>
                <p style="text-align:center; color:#666; margin-bottom:20px;">Gói: <b id="display-plan" style="color:#ff0000;"></b></p>
                <div style="text-align:left;">
                    <label style="font-size:13px;color:#888;">Họ và tên</label>
                    <input type="text" id="pay-name" placeholder="Ví dụ: Nguyễn Văn A" style="width:100%;padding:12px;margin:5px 0 15px;border:1px solid #ddd;border-radius:8px;outline:none;">
                    <label style="font-size:13px;color:#888;">Số điện thoại (Zalo)</label>
                    <input type="text" id="pay-phone" placeholder="Để chúng tôi hỗ trợ bạn" style="width:100%;padding:12px;margin:5px 0 20px;border:1px solid #ddd;border-radius:8px;outline:none;">
                </div>
                <button id="btn-submit-order" onclick="submitOrder()" style="width:100%;padding:15px;background:#ff0000;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px;">TIẾP TỤC THANH TOÁN</button>
                <button onclick="backToStep1()" style="width:100%;margin-top:15px;background:none;border:none;color:#666;cursor:pointer;text-decoration:underline;">Quay lại chọn gói</button>
            </div>

            <!-- BƯỚC 3: QUÉT MÃ QR -->
            <div id="payment-step-3" style="display:none; background:white;padding:30px;border-radius:20px;max-width:400px;width:90%;text-align:center;animation: fadeIn 0.3s;">
                <h3 style="margin-bottom:5px;">Quét mã VietQR</h3>
                <p style="font-size:14px;color:#666;">Mở ứng dụng Ngân hàng để quét mã bên dưới</p>
                <div style="margin:20px auto; padding:10px; border:1px solid #eee; border-radius:10px; width:fit-content;">
                    <img id="qr-code-img" src="" style="width:100%; max-width:250px; display:block;">
                </div>
                <div style="background:#fff3cd;padding:12px;border-radius:8px;font-size:13px;color:#856404;margin-bottom:20px;line-height:1.4;">
                    Hệ thống sẽ kiểm tra và kích hoạt tự động sau khi nhận được chuyển khoản (vui lòng không sửa nội dung chuyển tiền).
                </div>
                <button onclick="location.reload()" style="width:100%;padding:12px;background:#28a745;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">TÔI ĐÃ CHUYỂN TIỀN XONG</button>
            </div>
        </div>
        <style>@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }</style>`;
    document.body.insertAdjacentHTML('beforeend', paywallHtml);
}

function goToStep2(plan, amount) {
    selectedPlan = { plan, amount };
    document.getElementById('payment-step-1').style.display = 'none';
    document.getElementById('payment-step-2').style.display = 'block';
    document.getElementById('display-plan').innerText = plan + " (" + amount.toLocaleString() + "đ)";
}

function backToStep1() {
    document.getElementById('payment-step-1').style.display = 'block';
    document.getElementById('payment-step-2').style.display = 'none';
}

async function submitOrder() {
    const name = document.getElementById('pay-name').value.trim();
    const phone = document.getElementById('pay-phone').value.trim();
    const email = localStorage.getItem('user_email');
    const token = localStorage.getItem('access_token');
    const btn = document.getElementById('btn-submit-order');

    if (!name || !phone) { alert("Vui lòng điền đầy đủ họ tên và số điện thoại!"); return; }

    btn.innerText = "Đang xử lý...";
    btn.disabled = true;

    try {
        const res = await fetch(`${BACKEND_URL}/api/payment/createOrder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                full_name: name,
                phone: phone,
                plan: selectedPlan.plan,
                amount: selectedPlan.amount
            })
        });

        if (!res.ok) throw new Error("Không thể khởi tạo đơn hàng");

        // --- CẤU HÌNH NGÂN HÀNG CỦA BẠN TẠI ĐÂY ---
        const BANK_ID = "MSB"; 
        const ACCOUNT_NO = "04401015525214"; 
        const ACCOUNT_NAME = "VU THANH NHAN"; 
        const DESCRIPTION = "NAP YT " + (email && email !== "null" ? email : phone); 

        const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${selectedPlan.amount}&addInfo=${encodeURIComponent(DESCRIPTION)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
        
        document.getElementById('qr-code-img').src = qrUrl;
        document.getElementById('payment-step-2').style.display = 'none';
        document.getElementById('payment-step-3').style.display = 'block';
    } catch (err) {
        alert("Lỗi: " + err.message);
        btn.innerText = "TIẾP TỤC THANH TOÁN";
        btn.disabled = false;
    }
}

// ============================================
// 3. HÀM CHÍNH GỌI DỮ LIỆU TỪ BACKEND
// ============================================

async function fetchAllVideoInfo(youtubeUrl, apiKey) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập để sử dụng!');
        showAuthModal('login');
        throw new Error('AUTH_REQUIRED');
    }

    const deviceId = getDeviceFingerprint();

    console.log("Đang gửi yêu cầu lên Backend...");

    const response = await fetch(`${BACKEND_URL}/api/youtube/getVideoInfo`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
            youtubeUrl: youtubeUrl, 
            userApiKey: apiKey,
            deviceId: deviceId 
        })
    });

    if (response.status === 401) {
        alert("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!");
        logout();
        throw new Error("TOKEN_EXPIRED");
    }
    if (response.status === 402) {
        showPricingModal();
        throw new Error('LIMIT_REACHED');
    }

    const data = await response.json();

    if (!response.ok) {
        console.error("Lỗi Backend:", data);
        throw new Error(data.error || data.message || `Lỗi Server: ${response.status}`);
    }

    if (data.error) {
        console.error("Lỗi Google API:", data.error);
        throw new Error(`Google API báo lỗi: ${data.error.message}`);
    }

    if (!data.items || data.items.length === 0) {
        throw new Error('Không tìm thấy video này (hoặc Link sai).');
    }

    return data.items[0];
}

// ============================================
// 4. TIỆN ÍCH & PHÂN TÍCH
// ============================================

function getDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    const parts = [
        navigator.userAgent,
        screen.width + "x" + screen.height,
        navigator.hardwareConcurrency || "n/a",
        gl ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "no-gpu"
    ];
    return btoa(unescape(encodeURIComponent(parts.join('|'))));
}

function extractVideoId(url) {
    const patterns = [/(?:v=|\/)([a-zA-Z0-9_-]{11})/, /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    let res = [];
    if (match[1]) res.push(`${match[1]} giờ`);
    if (match[2]) res.push(`${match[2]} phút`);
    if (match[3]) res.push(`${match[3]} giây`);
    return res.join(' ') || '0 giây';
}

function calculatePopularityScore(views, likes, comments, daysOld) {
    if (daysOld === 0) daysOld = 1;
    return Math.round(((views / daysOld) * 0.7 + ((likes + comments) / views * 100) * 0.3) * 100) / 100;
}

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
            caption: content.content === 'true' ? 'Có' : 'Không'
        },
        analysis: {
            age: { daysOld: diffDays },
            engagement: { 
                engagementRate: viewCount > 0 ? ((likeCount + commentCount) / viewCount * 100).toFixed(2) + '%' : '0%',
                popularityScore: calculatePopularityScore(viewCount, likeCount, commentCount, diffDays)
            },
            seo: { titleLength: snippet.title.length, tagCount: (snippet.tags || []).length }
        },
        categorization: { categoryName: categoryName }
    };
}

async function fetchVideoCategory(categoryId, apiKey) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id=${categoryId}&key=${apiKey}`);
        const data = await response.json();
        return data.items?.[0]?.snippet?.title || 'Không xác định';
    } catch { return 'Không xác định'; }
}

async function fetchChannelInfo(channelId, apiKey) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
        const data = await response.json();
        return data.items?.[0] || null;
    } catch { return null; }
}

// ============================================
// 5. GIAO DIỆN HIỂN THỊ (TABS)
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
                            <p><b>Danh mục:</b> ${videoInfo.categorization.categoryName}</p>
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
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">Thời lượng:</td><td>${videoInfo.contentDetails.durationFormatted}</td></tr>
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
// 6. KHỞI TẠO LUỒNG CHÍNH
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
        console.log('🔄 Đang tải dữ liệu từ YouTube API...');
        const videoData = await fetchAllVideoInfo(youtubeUrl, apiKey);
        fullVideoData = videoData;
        
        const categoryName = await fetchVideoCategory(videoData.snippet.categoryId, apiKey);
        
        // Phân tích
        const analyzedData = analyzeVideoData(videoData, categoryName);
        
        // Hiển thị
        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = createTabInterface(analyzedData);
        resultDiv.style.display = 'block';
        
        setTimeout(initTabs, 100);
        
    } catch (error) {
        loadingDiv.style.display = 'none';
        // Chỉ hiện lỗi nếu không phải do Auth/Limit (đã có modal riêng)
        if (error.message !== 'AUTH_REQUIRED' && error.message !== 'LIMIT_REACHED' && error.message !== 'TOKEN_EXPIRED') {
            alert('Lỗi: ' + error.message);
        }
    }
}

// ============================================
// 7. KHỞI TẠO SỰ KIỆN KHI TẢI TRANG
// ============================================

getInfoBtn.addEventListener('click', getFullVideoInfo);

youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') getFullVideoInfo();
});

window.addEventListener('load', () => {
    checkLogin();
    const savedKey = localStorage.getItem('youtube_api_key');
    if (savedKey) apiKeyInput.value = savedKey;
});

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('youtube_api_key', apiKeyInput.value.trim());
});
