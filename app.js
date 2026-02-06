// ============================================
// YOUTUBE FULL INFO EXTRACTOR - LẤY MỌI THÔNG TIN
// ============================================
const BACKEND_URL = "https://yt-api-proxy.nyaochen9.workers.dev";
// Lấy các phần tử HTML
const youtubeUrlInput = document.getElementById('youtubeUrl');
const apiKeyInput = document.getElementById('apiKey');
const getInfoBtn = document.getElementById('getInfoBtn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('result');

// Biến toàn cục để lưu thông tin đầy đủ
let fullVideoData = null;

// ============================================
// 1. HÀM XỬ LÝ URL & VIDEO ID
// ============================================

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([^&]+)/,
        /(?:youtu\.be\/)([^?]+)/,
        /(?:youtube\.com\/embed\/)([^?]+)/,
        /(?:youtube\.com\/v\/)([^?]+)/,
        /(?:youtube\.com\/shorts\/)([^?]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0];
    }
    
    return null;
}

// ============================================
// 2. HÀM ĐỊNH DẠNG & CHUYỂN ĐỔI
// ============================================

function formatDate(isoDate) {
    const date = new Date(isoDate);
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    };
    return date.toLocaleDateString('vi-VN', options);
}

function formatNumber(num) {
    if (!num) return '0';
    const number = parseInt(num);
    if (number >= 1000000) {
        return (number / 1000000).toFixed(1) + ' triệu';
    }
    if (number >= 1000) {
        return (number / 1000).toFixed(1) + ' nghìn';
    }
    return number.toLocaleString('vi-VN');
}

function formatDuration(isoDuration) {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    let result = [];
    if (hours > 0) result.push(`${hours} giờ`);
    if (minutes > 0) result.push(`${minutes} phút`);
    if (seconds > 0) result.push(`${seconds} giây`);
    
    return result.join(' ') || '0 giây';
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// 3. HÀM LẤY TẤT CẢ THÔNG TIN
// ============================================

async function fetchAllVideoInfo(youtubeUrl, apiKey) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/youtube/getVideoInfo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                youtubeUrl: youtubeUrl,
                userApiKey: apiKey
            })
        });

        // Nếu hết lượt dùng (Backend trả về 402)
        if (response.status === 402) {
            showPricingModal(); // Hiện bảng giá
            throw new Error('LIMIT_REACHED');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Lỗi: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            throw new Error('Video không tồn tại hoặc không truy cập được');
        }
        
        return data.items[0];
        
    } catch (error) {
        if (error.message !== 'LIMIT_REACHED') {
            console.error('Error fetching video info:', error);
        }
        throw error;
    }
}

async function fetchVideoCategory(categoryId, apiKey) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id=${categoryId}&key=${apiKey}`
        );
        const data = await response.json();
        return data.items?.[0]?.snippet?.title || 'Không xác định';
    } catch {
        return 'Không xác định';
    }
}

async function fetchChannelInfo(channelId, apiKey) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
        );
        const data = await response.json();
        return data.items?.[0] || null;
    } catch {
        return null;
    }
}

// ============================================
// 4. HÀM XỬ LÝ & PHÂN TÍCH DỮ LIỆU
// ============================================

function analyzeVideoData(videoData, categoryName, channelInfo) {
    const snippet = videoData.snippet || {};
    const stats = videoData.statistics || {};
    const content = videoData.contentDetails || {};
    const status = videoData.status || {};
    const topics = videoData.topicDetails || {};
    const recording = videoData.recordingDetails || {};
    const live = videoData.liveStreamingDetails || {};
    const localizations = videoData.localizations || {};
    
    const publishedDate = new Date(snippet.publishedAt);
    const now = new Date();
    const diffTime = Math.abs(now - publishedDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    const viewCount = parseInt(stats.viewCount || 0);
    const likeCount = parseInt(stats.likeCount || 0);
    const commentCount = parseInt(stats.commentCount || 0);
    
    const likeRate = viewCount > 0 ? ((likeCount / viewCount) * 100).toFixed(2) : 0;
    const commentRate = viewCount > 0 ? ((commentCount / viewCount) * 100).toFixed(4) : 0;
    const engagementRate = ((likeCount + commentCount) / viewCount * 100).toFixed(2);
    
    const durationSec = parseDurationToSeconds(content.duration);
    const durationType = durationSec < 60 ? 'Ngắn' : 
                        durationSec < 300 ? 'Trung bình' : 
                        durationSec < 600 ? 'Dài' : 'Rất dài';
    
    const tags = snippet.tags || [];
    const tagCount = tags.length;
    const tagDensity = snippet.description ? 
        (tags.join(' ').length / snippet.description.length * 100).toFixed(2) : 0;
    
    return {
        basic: {
            title: snippet.title || 'Không có tiêu đề',
            description: snippet.description || 'Không có mô tả',
            videoId: videoData.id,
            channelTitle: snippet.channelTitle,
            channelId: snippet.channelId,
            publishedAt: snippet.publishedAt,
            publishedAtFormatted: formatDate(snippet.publishedAt),
            thumbnails: snippet.thumbnails || {}
        },
        statistics: {
            viewCount: formatNumber(stats.viewCount),
            viewCountRaw: parseInt(stats.viewCount || 0),
            likeCount: formatNumber(stats.likeCount),
            likeCountRaw: parseInt(stats.likeCount || 0),
            dislikeCount: formatNumber(stats.dislikeCount),
            commentCount: formatNumber(stats.commentCount),
            commentCountRaw: parseInt(stats.commentCount || 0),
            favoriteCount: formatNumber(stats.favoriteCount)
        },
        contentDetails: {
            duration: content.duration,
            durationFormatted: formatDuration(content.duration),
            durationSeconds: durationSec,
            durationType: durationType,
            dimension: content.dimension === '3d' ? '3D' : '2D',
            definition: content.definition === 'hd' ? 'HD (Chất lượng cao)' : 'SD (Chuẩn)',
            caption: content.caption === 'true' ? 'Có phụ đề' : 'Không có phụ đề',
            licensedContent: content.licensedContent ? 'Có bản quyền' : 'Không có bản quyền',
            projection: content.projection === '360' ? 'Video 360°' : 'Thông thường',
            hasCustomThumbnail: !!snippet.thumbnails?.maxres
        },
        status: {
            uploadStatus: status.uploadStatus || 'Không xác định',
            privacyStatus: status.privacyStatus === 'public' ? 'Công khai' : 
                         status.privacyStatus === 'private' ? 'Riêng tư' : 'Không công khai',
            license: status.license === 'youtube' ? 'YouTube Standard' : 'Creative Commons',
            embeddable: status.embeddable ? 'Có thể nhúng' : 'Không thể nhúng',
            publicStatsViewable: status.publicStatsViewable ? 'Hiện công khai' : 'Ẩn thống kê',
            madeForKids: status.madeForKids ? 'Video cho trẻ em' : 'Video cho mọi lứa tuổi'
        },
        categorization: {
            categoryId: snippet.categoryId,
            categoryName: categoryName,
            tags: tags,
            tagCount: tagCount,
            defaultLanguage: snippet.defaultLanguage || 'Không xác định',
            defaultAudioLanguage: snippet.defaultAudioLanguage || 'Không xác định'
        },
        topics: {
            topicCategories: topics.topicCategories || [],
            relevantTopicIds: topics.relevantTopicIds || [],
            topicCount: (topics.topicCategories || []).length
        },
        localizations: {
            availableLanguages: Object.keys(localizations).length,
            languages: Object.keys(localizations),
            hasLocalizedContent: Object.keys(localizations).length > 0
        },
        liveStreaming: live ? {
            actualStartTime: live.actualStartTime,
            actualEndTime: live.actualEndTime,
            scheduledStartTime: live.scheduledStartTime,
            scheduledEndTime: live.scheduledEndTime,
            concurrentViewers: live.concurrentViewers,
            wasLive: true
        } : { wasLive: false },
        recordingDetails: recording.location ? {
            locationDescription: recording.locationDescription,
            hasLocation: true
        } : { hasLocation: false },
        analysis: {
            age: {
                daysOld: diffDays,
                monthsOld: diffMonths,
                yearsOld: diffYears,
                ageDescription: diffDays < 7 ? 'Video mới' : 
                               diffDays < 30 ? 'Video gần đây' : 
                               diffDays < 365 ? 'Video cũ' : 'Video rất cũ'
            },
            engagement: {
                likeRate: `${likeRate}%`,
                commentRate: `${commentRate}%`,
                engagementRate: `${engagementRate}%`,
                popularityScore: calculatePopularityScore(viewCount, likeCount, commentCount, diffDays)
            },
            seo: {
                titleLength: snippet.title?.length || 0,
                descriptionLength: snippet.description?.length || 0,
                tagDensity: `${tagDensity}%`,
                hasTags: tagCount > 0,
                hasDescription: !!snippet.description,
                descriptionWordCount: snippet.description?.split(' ').length || 0
            }
        },
        channel: channelInfo ? {
            channelTitle: channelInfo.snippet?.title,
            subscriberCount: formatNumber(channelInfo.statistics?.subscriberCount),
            videoCount: formatNumber(channelInfo.statistics?.videoCount),
            viewCount: formatNumber(channelInfo.statistics?.viewCount),
            description: channelInfo.snippet?.description || 'Không có mô tả',
            customUrl: channelInfo.snippet?.customUrl,
            publishedAt: channelInfo.snippet?.publishedAt
        } : null
    };
}

function parseDurationToSeconds(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
}

function calculatePopularityScore(views, likes, comments, daysOld) {
    if (daysOld === 0) daysOld = 1;
    const dailyViews = views / daysOld;
    const engagement = (likes + comments) / views * 100;
    return Math.round((dailyViews * 0.7 + engagement * 0.3) * 100) / 100;
}

// ============================================
// 5. HÀM HIỂN THỊ GIAO DIỆN TAB
// ============================================

function createTabInterface(videoInfo) {
    return `
        <div class="tabs-container">
            <div class="tabs-header">
                <button class="tab-btn active" data-tab="overview">
                    <i class="fas fa-eye"></i> Tổng quan
                </button>
                <button class="tab-btn" data-tab="details">
                    <i class="fas fa-info-circle"></i> Chi tiết
                </button>
                <button class="tab-btn" data-tab="statistics">
                    <i class="fas fa-chart-bar"></i> Thống kê
                </button>
                <button class="tab-btn" data-tab="analysis">
                    <i class="fas fa-chart-line"></i> Phân tích
                </button>
                <button class="tab-btn" data-tab="rawdata">
                    <i class="fas fa-code"></i> Dữ liệu gốc
                </button>
            </div>
            
            <div class="tabs-content">
                <div class="tab-pane active" id="overview-tab">
                    ${createOverviewTab(videoInfo)}
                </div>
                <div class="tab-pane" id="details-tab">
                    ${createDetailsTab(videoInfo)}
                </div>
                <div class="tab-pane" id="statistics-tab">
                    ${createStatisticsTab(videoInfo)}
                </div>
                <div class="tab-pane" id="analysis-tab">
                    ${createAnalysisTab(videoInfo)}
                </div>
                <div class="tab-pane" id="rawdata-tab">
                    ${createRawDataTab(videoInfo)}
                </div>
            </div>
        </div>
    `;
}

function createOverviewTab(videoInfo) {
    const thumb = videoInfo.basic.thumbnails.maxres || 
                  videoInfo.basic.thumbnails.standard || 
                  videoInfo.basic.thumbnails.high;
    
    return `
        <div class="overview-grid">
            <div class="video-preview">
                <img src="${thumb?.url || ''}" alt="${videoInfo.basic.title}" 
                     style="max-width: 100%; border-radius: 8px;">
                <div class="preview-info">
                    <h3><i class="fas fa-play-circle"></i> Xem trước video</h3>
                    <p>Video ID: <code>${videoInfo.basic.videoId}</code></p>
                    <button onclick="window.open('https://youtube.com/watch?v=${videoInfo.basic.videoId}', '_blank')" 
                            class="btn-watch">
                        <i class="fab fa-youtube"></i> Xem trên YouTube
                    </button>
                </div>
            </div>
            
            <div class="basic-info">
                <h2>${videoInfo.basic.title}</h2>
                
                <div class="info-grid">
                    <div class="info-card">
                        <i class="fas fa-user-circle"></i>
                        <h4>Kênh</h4>
                        <p>${videoInfo.basic.channelTitle}</p>
                    </div>
                    
                    <div class="info-card">
                        <i class="fas fa-calendar-alt"></i>
                        <h4>Đăng lúc</h4>
                        <p>${videoInfo.basic.publishedAtFormatted}</p>
                        <small>${videoInfo.analysis.age.ageDescription}</small>
                    </div>
                    
                    <div class="info-card">
                        <i class="fas fa-clock"></i>
                        <h4>Thời lượng</h4>
                        <p>${videoInfo.contentDetails.durationFormatted}</p>
                        <small>${videoInfo.contentDetails.durationType}</small>
                    </div>
                    
                    <div class="info-card">
                        <i class="fas fa-hashtag"></i>
                        <h4>Danh mục</h4>
                        <p>${videoInfo.categorization.categoryName}</p>
                    </div>
                </div>
                
                <div class="quick-stats">
                    <div class="stat">
                        <i class="fas fa-eye" style="color: #3498db;"></i>
                        <span>${videoInfo.statistics.viewCount}</span>
                        <small>Lượt xem</small>
                    </div>
                    <div class="stat">
                        <i class="fas fa-thumbs-up" style="color: #2ecc71;"></i>
                        <span>${videoInfo.statistics.likeCount}</span>
                        <small>Lượt thích</small>
                    </div>
                    <div class="stat">
                        <i class="fas fa-comment" style="color: #9b59b6;"></i>
                        <span>${videoInfo.statistics.commentCount}</span>
                        <small>Bình luận</small>
                    </div>
                    <div class="stat">
                        <i class="fas fa-tags" style="color: #e74c3c;"></i>
                        <span>${videoInfo.categorization.tagCount}</span>
                        <small>Tags</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="description-box">
            <h3><i class="fas fa-align-left"></i> Mô tả video</h3>
            <p>${videoInfo.basic.description.replace(/\n/g, '<br>')}</p>
            <div class="description-meta">
                <span><i class="fas fa-ruler"></i> ${videoInfo.analysis.seo.descriptionLength} ký tự</span>
                <span><i class="fas fa-list-ol"></i> ${videoInfo.analysis.seo.descriptionWordCount} từ</span>
            </div>
        </div>
    `;
}

function createDetailsTab(videoInfo) {
    return `
        <div class="details-grid">
            <div class="detail-section">
                <h3><i class="fas fa-cogs"></i> Thông số kỹ thuật</h3>
                <table class="details-table">
                    <tr><td>Độ phân giải:</td><td><strong>${videoInfo.contentDetails.definition}</strong></td></tr>
                    <tr><td>Chế độ 3D:</td><td>${videoInfo.contentDetails.dimension}</td></tr>
                    <tr><td>Video 360°:</td><td>${videoInfo.contentDetails.projection}</td></tr>
                    <tr><td>Phụ đề:</td><td>${videoInfo.contentDetails.caption}</td></tr>
                    <tr><td>Bản quyền:</td><td>${videoInfo.contentDetails.licensedContent}</td></tr>
                </table>
            </div>
            <div class="detail-section">
                <h3><i class="fas fa-lock"></i> Trạng thái & Quyền</h3>
                <table class="details-table">
                    <tr><td>Chế độ riêng tư:</td><td>${videoInfo.status.privacyStatus}</td></tr>
                    <tr><td>Giấy phép:</td><td>${videoInfo.status.license}</td></tr>
                    <tr><td>Cho trẻ em:</td><td>${videoInfo.status.madeForKids}</td></tr>
                </table>
            </div>
        </div>
    `;
}

function createStatisticsTab(videoInfo) {
    const views = videoInfo.statistics.viewCountRaw;
    const likes = videoInfo.statistics.likeCountRaw;
    const comments = videoInfo.statistics.commentCountRaw;
    
    return `
        <div class="stats-container">
            <h3><i class="fas fa-chart-pie"></i> Phân bổ tương tác</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Lượt xem</h4>
                    <div class="stat-number">${videoInfo.statistics.viewCount}</div>
                </div>
                <div class="stat-card">
                    <h4>Lượt thích</h4>
                    <div class="stat-number">${videoInfo.statistics.likeCount}</div>
                </div>
                <div class="stat-card">
                    <h4>Bình luận</h4>
                    <div class="stat-number">${videoInfo.statistics.commentCount}</div>
                </div>
            </div>
        </div>
    `;
}

function createAnalysisTab(videoInfo) {
    return `
        <div class="analysis-container">
            <div class="analysis-card">
                <h3><i class="fas fa-search"></i> Phân tích SEO</h3>
                <table class="analysis-table">
                    <tr><td>Độ dài tiêu đề:</td><td>${videoInfo.analysis.seo.titleLength} ký tự</td></tr>
                    <tr><td>Số từ mô tả:</td><td>${videoInfo.analysis.seo.descriptionWordCount} từ</td></tr>
                    <tr><td>Số lượng Tags:</td><td>${videoInfo.categorization.tagCount}</td></tr>
                </table>
            </div>
        </div>
    `;
}

function createRawDataTab(videoInfo) {
    return `
        <div class="rawdata-container">
            <h3><i class="fas fa-code"></i> Dữ liệu JSON gốc</h3>
            <pre style="background: #f4f4f4; padding: 15px; border-radius: 5px; overflow: auto; max-height: 400px;">
                ${JSON.stringify(fullVideoData, null, 2)}
            </pre>
        </div>
    `;
}

// ============================================
// 6. HÀM XỬ LÝ SỰ KIỆN & TÁC VỤ
// ============================================

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// ============================================
// 7. HÀM CHÍNH LẤY THÔNG TIN (ĐÃ SỬA GIỚI HẠN 3 LẦN)
// ============================================

async function getFullVideoInfo() {
    const youtubeUrl = youtubeUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    // --- KIỂM TRA LƯỢT DÙNG MIỄN PHÍ ---
    let usageCount = parseInt(localStorage.getItem('yt_usage_count') || '0');
    let isPaid = localStorage.getItem('yt_is_paid') === 'true';

    if (!isPaid && usageCount >= 3) {
        showPricingModal();
        return; 
    }
    // ----------------------------------

    if (!youtubeUrl) {
        alert('📝 Vui lòng dán URL YouTube vào ô trên cùng');
        return;
    }
    
    if (!apiKey) {
        alert('🔑 Vui lòng nhập API Key của bạn');
        return;
    }
    
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
        alert('❌ URL YouTube không hợp lệ. Vui lòng kiểm tra lại!');
        return;
    }
    
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
    
    try {
        console.log('🔄 Đang tải dữ liệu từ YouTube API...');
        const videoData = await fetchAllVideoInfo(youtubeUrl, apiKey);
        fullVideoData = videoData;
        
        const categoryName = await fetchVideoCategory(videoData.snippet.categoryId, apiKey);
        
        let channelInfo = null;
        if (videoData.snippet.channelId) {
            channelInfo = await fetchChannelInfo(videoData.snippet.channelId, apiKey);
        }
        
        const analyzedData = analyzeVideoData(videoData, categoryName, channelInfo);
        
        // --- TĂNG LƯỢT DÙNG KHI THÀNH CÔNG ---
        if (!isPaid) {
            usageCount++;
            localStorage.setItem('yt_usage_count', usageCount);
            console.log("Số lần đã dùng: " + usageCount);
        }
        // ------------------------------------

        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = createTabInterface(analyzedData);
        resultDiv.style.display = 'block';
        
        setTimeout(initTabs, 100);
        
    } catch (error) {
        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = `<div class="error"><h3>LỖI: ${error.message}</h3></div>`;
        resultDiv.style.display = 'block';
    }
}

// Hàm hiển thị bảng giá khi hết lượt
function showPricingModal() {
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
                        <button onclick="window.open('https://momo.vn','_blank')" style="background:#ff0000;color:white;border:none;padding:10px;width:100%;border-radius:5px;cursor:pointer;">MUA NGAY</button>
                    </div>
                </div>
                <button onclick="location.reload()" style="margin-top:20px;background:none;border:none;color:#999;text-decoration:underline;cursor:pointer;">Quay lại sau</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', paywallHtml);
}

// ============================================
// 8. KHỞI TẠO ỨNG DỤNG
// ============================================

getInfoBtn.addEventListener('click', getFullVideoInfo);

youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') getFullVideoInfo();
});

window.addEventListener('load', () => {
    const savedApiKey = localStorage.getItem('youtube_api_key');
    if (savedApiKey) apiKeyInput.value = savedApiKey;
});

apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('youtube_api_key', apiKeyInput.value.trim());
});

let currentAuthAction = 'login';

function showAuthModal(action) {
    currentAuthAction = action;
    document.getElementById('modal-title').innerText = action === 'login' ? 'Đăng nhập' : 'Đăng ký';
    document.getElementById('auth-modal').style.display = 'flex';
}

async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    const res = await fetch(`${BACKEND_URL}/api/auth/${currentAuthAction}`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (res.ok) {
        if (currentAuthAction === 'login') {
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('user_email', data.user.email); // Dòng này mới để lưu email
          location.reload();
        } else {
            alert('Đăng ký thành công! Hãy đăng nhập.');
            showAuthModal('login');
        }
   } else {
    // Hiện lỗi chi tiết từ server hoặc log ra console
    console.error("Auth Error Data:", data);
    alert("Lỗi từ Server: " + (data.msg || data.error_description || data.error || JSON.stringify(data)));
   }
}

function checkLogin() {
    // 1. Xử lý nếu người dùng vừa nhấn link xác thực từ Email
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const token = params.get("access_token");
        if (token) {
            localStorage.setItem('access_token', token);
            // Tạm thời để "Đã xác thực", email sẽ được cập nhật sau khi gọi API hoặc login lại
            localStorage.setItem('user_email', "Thành viên");
            window.history.replaceState(null, null, window.location.pathname);
        }
    }

    // 2. Kiểm tra xem có đang đăng nhập không
    const token = localStorage.getItem('access_token');
    const email = localStorage.getItem('user_email');
    
    const loggedInDiv = document.getElementById('user-logged-in');
    const loggedOutDiv = document.getElementById('user-logged-out');
    const emailSpan = document.getElementById('user-email');

    if (token) {
        if (loggedInDiv) loggedInDiv.style.display = 'flex';
        if (loggedOutDiv) loggedOutDiv.style.display = 'none';
        if (emailSpan && email) {
            emailSpan.innerText = email; // Đưa email vào thẻ span để hiển thị
        }
    } else {
        if (loggedInDiv) loggedInDiv.style.display = 'none';
        if (loggedOutDiv) loggedOutDiv.style.display = 'flex';
    }
}
    // --- KẾT THÚC ĐOẠN MỚI ---

    const token = localStorage.getItem('access_token');
    const email = localStorage.getItem('user_email');
    if (token) {
        document.getElementById('user-logged-in').style.display = 'block';
        document.getElementById('user-logged-out').style.display = 'none';
        document.getElementById('user-email').innerText = email !== "null" ? email : "Đã đăng nhập";
    }
}

function logout() {
    localStorage.removeItem('access_token');
    location.reload();
}

// Chỉnh sửa lại hàm fetchAllVideoInfo để gửi Token
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
    // ... giữ nguyên phần xử lý response cũ ...
}

window.onload = checkLogin;
