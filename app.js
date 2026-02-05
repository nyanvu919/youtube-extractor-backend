// ============================================
// YOUTUBE FULL INFO EXTRACTOR - LẤY MỌI THÔNG TIN
// ============================================

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
    // PT1H2M30S -> 1 giờ 2 phút 30 giây
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

async function fetchAllVideoInfo(videoId, apiKey) {
    try {
        // Gọi API với TẤT CẢ các parts có thể
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status,topicDetails,recordingDetails,liveStreamingDetails,localizations&id=${videoId}&key=${apiKey}`
        );
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            throw new Error('Video không tồn tại hoặc không truy cập được');
        }
        
        return data.items[0];
        
    } catch (error) {
        console.error('Error fetching video info:', error);
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
    
    // Phân tích thời gian
    const publishedDate = new Date(snippet.publishedAt);
    const now = new Date();
    const diffTime = Math.abs(now - publishedDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    // Phân tích engagement rate
    const viewCount = parseInt(stats.viewCount || 0);
    const likeCount = parseInt(stats.likeCount || 0);
    const commentCount = parseInt(stats.commentCount || 0);
    
    const likeRate = viewCount > 0 ? ((likeCount / viewCount) * 100).toFixed(2) : 0;
    const commentRate = viewCount > 0 ? ((commentCount / viewCount) * 100).toFixed(4) : 0;
    const engagementRate = ((likeCount + commentCount) / viewCount * 100).toFixed(2);
    
    // Phân tích thời lượng
    const durationSec = parseDurationToSeconds(content.duration);
    const durationType = durationSec < 60 ? 'Ngắn' : 
                        durationSec < 300 ? 'Trung bình' : 
                        durationSec < 600 ? 'Dài' : 'Rất dài';
    
    // Phân tích tags
    const tags = snippet.tags || [];
    const tagCount = tags.length;
    const tagDensity = snippet.description ? 
        (tags.join(' ').length / snippet.description.length * 100).toFixed(2) : 0;
    
    return {
        // Thông tin cơ bản
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
        
        // Thống kê
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
        
        // Chi tiết nội dung
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
        
        // Trạng thái
        status: {
            uploadStatus: status.uploadStatus || 'Không xác định',
            privacyStatus: status.privacyStatus === 'public' ? 'Công khai' : 
                         status.privacyStatus === 'private' ? 'Riêng tư' : 'Không công khai',
            license: status.license === 'youtube' ? 'YouTube Standard' : 'Creative Commons',
            embeddable: status.embeddable ? 'Có thể nhúng' : 'Không thể nhúng',
            publicStatsViewable: status.publicStatsViewable ? 'Hiện công khai' : 'Ẩn thống kê',
            madeForKids: status.madeForKids ? 'Video cho trẻ em' : 'Video cho mọi lứa tuổi'
        },
        
        // Phân loại
        categorization: {
            categoryId: snippet.categoryId,
            categoryName: categoryName,
            tags: tags,
            tagCount: tagCount,
            defaultLanguage: snippet.defaultLanguage || 'Không xác định',
            defaultAudioLanguage: snippet.defaultAudioLanguage || 'Không xác định'
        },
        
        // Chủ đề
        topics: {
            topicCategories: topics.topicCategories || [],
            relevantTopicIds: topics.relevantTopicIds || [],
            topicCount: (topics.topicCategories || []).length
        },
        
        // Localizations
        localizations: {
            availableLanguages: Object.keys(localizations).length,
            languages: Object.keys(localizations),
            hasLocalizedContent: Object.keys(localizations).length > 0
        },
        
        // Live stream (nếu có)
        liveStreaming: live ? {
            actualStartTime: live.actualStartTime,
            actualEndTime: live.actualEndTime,
            scheduledStartTime: live.scheduledStartTime,
            scheduledEndTime: live.scheduledEndTime,
            concurrentViewers: live.concurrentViewers,
            wasLive: true
        } : { wasLive: false },
        
        // Recording details (nếu có)
        recordingDetails: recording.location ? {
            locationDescription: recording.locationDescription,
            hasLocation: true
        } : { hasLocation: false },
        
        // Phân tích
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
        
        // Thông tin kênh (nếu có)
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
        
        ${videoInfo.categorization.tags.length > 0 ? `
            <div class="tags-section">
                <h3><i class="fas fa-tags"></i> Tags (${videoInfo.categorization.tagCount} tags)</h3>
                <div class="tags-cloud">
                    ${videoInfo.categorization.tags.map((tag, index) => `
                        <span class="tag" style="font-size: ${12 + Math.min(tag.length, 10)}px">
                            ${tag}
                            <small>${index + 1}</small>
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : ''}
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
                    <tr><td>Thumbnail tùy chỉnh:</td><td>${videoInfo.contentDetails.hasCustomThumbnail ? 'Có' : 'Không'}</td></tr>
                </table>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-lock"></i> Trạng thái & Quyền</h3>
                <table class="details-table">
                    <tr><td>Trạng thái tải lên:</td><td>${videoInfo.status.uploadStatus}</td></tr>
                    <tr><td>Chế độ riêng tư:</td><td>${videoInfo.status.privacyStatus}</td></tr>
                    <tr><td>Giấy phép:</td><td>${videoInfo.status.license}</td></tr>
                    <tr><td>Có thể nhúng:</td><td>${videoInfo.status.embeddable}</td></tr>
                    <tr><td>Thống kê công khai:</td><td>${videoInfo.status.publicStatsViewable}</td></tr>
                    <tr><td>Cho trẻ em:</td><td>${videoInfo.status.madeForKids}</td></tr>
                </table>
            </div>
            
            <div class="detail-section">
                <h3><i class="fas fa-globe"></i> Ngôn ngữ & Vùng</h3>
                <table class="details-table">
                    <tr><td>Ngôn ngữ mặc định:</td><td>${videoInfo.categorization.defaultLanguage}</td></tr>
                    <tr><td>Ngôn ngữ audio:</td><td>${videoInfo.categorization.defaultAudioLanguage}</td></tr>
                    <tr><td>Bản địa hóa:</td><td>${videoInfo.localizations.availableLanguages} ngôn ngữ</td></tr>
                    <tr><td>Live Stream:</td><td>${videoInfo.liveStreaming.wasLive ? 'Có' : 'Không'}</td></tr>
                    <tr><td>Vị trí quay:</td><td>${videoInfo.recordingDetails.hasLocation ? 'Có' : 'Không'}</td></tr>
                </table>
            </div>
            
            <div class="detail-section full-width">
                <h3><i class="fas fa-layer-group"></i> Thumbnails có sẵn</h3>
                <div class="thumbnails-grid">
                    ${Object.entries(videoInfo.basic.thumbnails).map(([key, thumb]) => `
                        <div class="thumbnail-item">
                            <img src="${thumb.url}" alt="${key}" style="width: 100%">
                            <div class="thumbnail-info">
                                <strong>${key.toUpperCase()}</strong><br>
                                ${thumb.width}×${thumb.height}px<br>
                                <button onclick="window.open('${thumb.url}', '_blank')" class="btn-small">
                                    <i class="fas fa-external-link-alt"></i> Mở
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${videoInfo.topics.topicCount > 0 ? `
                <div class="detail-section full-width">
                    <h3><i class="fas fa-folder"></i> Chủ đề phân loại (${videoInfo.topics.topicCount})</h3>
                    <div class="topics-list">
                        ${videoInfo.topics.topicCategories.map(url => `
                            <div class="topic-item">
                                <i class="fas fa-link"></i>
                                <a href="${url}" target="_blank">${url}</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
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
                    <div class="stat-header">
                        <i class="fas fa-eye" style="color: #3498db;"></i>
                        <h4>Lượt xem</h4>
                    </div>
                    <div class="stat-number">${videoInfo.statistics.viewCount}</div>
                    <div class="stat-progress">
                        <div class="progress-bar" style="width: 100%; background: #3498db;"></div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <i class="fas fa-thumbs-up" style="color: #2ecc71;"></i>
                        <h4>Lượt thích</h4>
                    </div>
                    <div class="stat-number">${videoInfo.statistics.likeCount}</div>
                    <div class="stat-progress">
                        <div class="progress-bar" style="width: ${views > 0 ? (likes/views*100) : 0}%; background: #2ecc71;"></div>
                    </div>
                    <div class="stat-percent">${views > 0 ? (likes/views*100).toFixed(2) : 0}%</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <i class="fas fa-comment" style="color: #9b59b6;"></i>
                        <h4>Bình luận</h4>
                    </div>
                    <div class="stat-number">${videoInfo.statistics.commentCount}</div>
                    <div class="stat-progress">
                        <div class="progress-bar" style="width: ${views > 0 ? (comments/views*100) : 0}%; background: #9b59b6;"></div>
                    </div>
                    <div class="stat-percent">${views > 0 ? (comments/views*100).toFixed(2) : 0}%</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <i class="fas fa-heart" style="color: #e74c3c;"></i>
                        <h4>Yêu thích</h4>
                    </div>
                    <div class="stat-number">${videoInfo.statistics.favoriteCount}</div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-box">
                    <h4><i class="fas fa-percentage"></i> Tỷ lệ tương tác</h4>
                    <div class="chart-bar">
                        <div class="chart-label">Lượt thích</div>
                        <div class="chart-track">
                            <div class="chart-fill" style="width: ${videoInfo.analysis.engagement.likeRate.replace('%','')}%"></div>
                        </div>
                        <div class="chart-value">${videoInfo.analysis.engagement.likeRate}</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">Bình luận</div>
                        <div class="chart-track">
                            <div class="chart-fill" style="width: ${videoInfo.analysis.engagement.commentRate.replace('%','')*100}%"></div>
                        </div>
                        <div class="chart-value">${videoInfo.analysis.engagement.commentRate}</div>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-label">Tổng tương tác</div>
                        <div class="chart-track">
                            <div class="chart-fill" style="width: ${videoInfo.analysis.engagement.engagementRate.replace('%','')}%"></div>
                        </div>
                        <div class="chart-value">${videoInfo.analysis.engagement.engagementRate}</div>
                    </div>
                </div>
                
                <div class="chart-box">
                    <h4><i class="fas fa-tachometer-alt"></i> Điểm số phổ biến</h4>
                    <div class="score-display">
                        <div class="score-circle">
                            <div class="score-text">${videoInfo.analysis.engagement.popularityScore}</div>
                        </div>
                        <div class="score-info">
                            <p><strong>Thuật toán tính:</strong></p>
                            <p>(Lượt xem/ngày × 70%) + (Tỷ lệ tương tác × 30%)</p>
                        </div>
                    </div>
                </div>
            </div>
            
            ${videoInfo.channel ? `
                <div class="channel-stats">
                    <h3><i class="fas fa-broadcast-tower"></i> Thống kê kênh</h3>
                    <div class="channel-grid">
                        <div class="channel-stat">
                            <i class="fas fa-users"></i>
                            <div>
                                <strong>${videoInfo.channel.subscriberCount}</strong>
                                <small>Người đăng ký</small>
                            </div>
                        </div>
                        <div class="channel-stat">
                            <i class="fas fa-video"></i>
                            <div>
                                <strong>${videoInfo.channel.videoCount}</strong>
                                <small>Video</small>
                            </div>
                        </div>
                        <div class="channel-stat">
                            <i class="fas fa-eye"></i>
                            <div>
                                <strong>${videoInfo.channel.viewCount}</strong>
                                <small>Lượt xem</small>
                            </div>
                        </div>
                        <div class="channel-stat">
                            <i class="fas fa-calendar"></i>
                            <div>
                                <strong>${formatDate(videoInfo.channel.publishedAt)}</strong>
                                <small>Tham gia</small>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function createAnalysisTab(videoInfo) {
    return `
        <div class="analysis-container">
            <div class="analysis-card">
                <h3><i class="fas fa-calendar-check"></i> Phân tích thời gian</h3>
                <div class="analysis-grid">
                    <div class="analysis-item">
                        <div class="analysis-icon" style="background: #3498db;">
                            <i class="fas fa-birthday-cake"></i>
                        </div>
                        <div>
                            <strong>${videoInfo.analysis.age.daysOld} ngày tuổi</strong>
                            <p>Đã đăng ${videoInfo.analysis.age.yearsOld} năm, ${videoInfo.analysis.age.monthsOld} tháng trước</p>
                        </div>
                    </div>
                    <div class="analysis-item">
                        <div class="analysis-icon" style="background: #2ecc71;">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div>
                            <strong>${videoInfo.analysis.age.ageDescription}</strong>
                            <p>${videoInfo.analysis.age.daysOld < 30 ? 'Video còn mới và có tiềm năng viral' : 'Video đã ổn định về lượng xem'}</p>
                        </div>
                    </div>
                    <div class="analysis-item">
                        <div class="analysis-icon" style="background: #9b59b6;">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div>
                            <strong>${Math.round(videoInfo.statistics.viewCountRaw / videoInfo.analysis.age.daysOld).toLocaleString()}</strong>
                            <p>Lượt xem trung bình mỗi ngày</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="analysis-card">
                <h3><i class="fas fa-search"></i> Phân tích SEO</h3>
                <table class="analysis-table">
                    <tr>
                        <td><i class="fas fa-heading"></i> Tiêu đề</td>
                        <td>${videoInfo.analysis.seo.titleLength} ký tự</td>
                        <td>${videoInfo.analysis.seo.titleLength > 60 ? '🔴 Quá dài' : videoInfo.analysis.seo.titleLength > 50 ? '🟡 Tốt' : '🟢 Tối ưu'}</td>
                    </tr>
                    <tr>
                        <td><i class="fas fa-align-left"></i> Mô tả</td>
                        <td>${videoInfo.analysis.seo.descriptionWordCount} từ</td>
                        <td>${videoInfo.analysis.seo.descriptionWordCount > 300 ? '🟢 Tốt' : videoInfo.analysis.seo.descriptionWordCount > 100 ? '🟡 Trung bình' : '🔴 Quá ngắn'}</td>
                    </tr>
                    <tr>
                        <td><i class="fas fa-tags"></i> Mật độ Tags</td>
                        <td>${videoInfo.analysis.seo.tagDensity}</td>
                        <td>${parseFloat(videoInfo.analysis.seo.tagDensity) > 5 ? '🟢 Tốt' : '🟡 Trung bình'}</td>
                    </tr>
                    <tr>
                        <td><i class="fas fa-hashtag"></i> Số lượng Tags</td>
                        <td>${videoInfo.categorization.tagCount} tags</td>
                        <td>${videoInfo.categorization.tagCount >= 5 ? '🟢 Tối ưu' : '🔴 Cần thêm tags'}</td>
                    </tr>
                </table>
            </div>
            
            <div class="analysis-card">
                <h3><i class="fas fa-lightbulb"></i> Đề xuất cải thiện</h3>
                <div class="recommendations">
                    ${getRecommendations(videoInfo).map(rec => `
                        <div class="recommendation ${rec.priority}">
                            <i class="fas fa-${rec.icon}"></i>
                            <div>
                                <strong>${rec.title}</strong>
                                <p>${rec.description}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function getRecommendations(videoInfo) {
    const recs = [];
    
    if (videoInfo.categorization.tagCount < 5) {
        recs.push({
            priority: 'high',
            icon: 'exclamation-triangle',
            title: 'Thêm nhiều tags hơn',
            description: `Video chỉ có ${videoInfo.categorization.tagCount} tags. YouTube khuyến nghị 10-15 tags để tối ưu tìm kiếm.`
        });
    }
    
    if (videoInfo.analysis.seo.descriptionWordCount < 150) {
        recs.push({
            priority: 'medium',
            icon: 'file-alt',
            title: 'Mở rộng mô tả',
            description: 'Mô tả quá ngắn. Thêm từ khóa, timestamps, link liên kết để tăng thời gian xem.'
        });
    }
    
    if (videoInfo.contentDetails.caption === 'Không có phụ đề') {
        recs.push({
            priority: 'low',
            icon: 'closed-captioning',
            title: 'Thêm phụ đề',
            description: 'Video không có phụ đề. Thêm phụ đề để tiếp cận khán giả khiếm thính và tăng SEO.'
        });
    }
    
    if (parseFloat(videoInfo.analysis.engagement.likeRate) < 3) {
        recs.push({
            priority: 'high',
            icon: 'thumbs-up',
            title: 'Cải thiện tỷ lệ thích',
            description: `Tỷ lệ thích chỉ ${videoInfo.analysis.engagement.likeRate}. Xem lại nội dung để tăng tương tác.`
        });
    }
    
    if (recs.length === 0) {
        recs.push({
            priority: 'low',
            icon: 'check-circle',
            title: 'Video đã tối ưu tốt',
            description: 'Video của bạn đã đáp ứng hầu hết các tiêu chí tối ưu của YouTube.'
        });
    }
    
    return recs;
}

function createRawDataTab() {
    return `
        <div class="rawdata-container">
            <h3><i class="fas fa-database"></i> Dữ liệu JSON gốc từ YouTube API</h3>
            <p class="rawdata-info">
                Dưới đây là toàn bộ dữ liệu thô nhận được từ YouTube API.<br>
                Bạn có thể copy để phân tích chuyên sâu hoặc sử dụng cho các mục đích khác.
            </p>
            
            <div class="rawdata-actions">
                <button onclick="copyRawData()" class="btn-copy">
                    <i class="fas fa-copy"></i> Copy JSON
                </button>
                <button onclick="downloadRawData()" class="btn-download">
                    <i class="fas fa-download"></i> Tải file JSON
                </button>
                <button onclick="toggleRawData()" class="btn-toggle">
                    <i class="fas fa-expand"></i> Hiển thị/Ẩn
                </button>
            </div>
            
            <div id="rawdata-content" class="rawdata-content">
                <pre><code>${JSON.stringify(fullVideoData, null, 2)}</code></pre>
            </div>
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
            // Xóa active cũ
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Thêm active mới
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

function copyRawData() {
    const rawData = JSON.stringify(fullVideoData, null, 2);
    navigator.clipboard.writeText(rawData)
        .then(() => {
            alert('✅ Đã copy toàn bộ dữ liệu vào clipboard!');
        })
        .catch(err => {
            console.error('Copy failed:', err);
            alert('❌ Lỗi khi copy dữ liệu');
        });
}

function downloadRawData() {
    const dataStr = JSON.stringify(fullVideoData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube_data_${fullVideoData.id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toggleRawData() {
    const content = document.getElementById('rawdata-content');
    if (content.style.display === 'none') {
        content.style.display = 'block';
    } else {
        content.style.display = 'none';
    }
}

// ============================================
// 7. HÀM CHÍNH LẤY THÔNG TIN
// ============================================

async function getFullVideoInfo() {
    const youtubeUrl = youtubeUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    // Kiểm tra input
    if (!youtubeUrl) {
        alert('📝 Vui lòng dán URL YouTube vào ô trên cùng');
        return;
    }
    
    if (!apiKey) {
        alert('🔑 Vui lòng nhập API Key của bạn');
        return;
    }
    
    // Lấy Video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
        alert('❌ URL YouTube không hợp lệ. Vui lòng kiểm tra lại!');
        return;
    }
    
    // Hiển thị loading
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
    
    try {
        // 1. Lấy toàn bộ thông tin video
        console.log('🔄 Đang tải dữ liệu từ YouTube API...');
        const videoData = await fetchAllVideoInfo(videoId, apiKey);
        fullVideoData = videoData;
        
        // 2. Lấy thông tin danh mục
        const categoryName = await fetchVideoCategory(videoData.snippet.categoryId, apiKey);
        
        // 3. Lấy thông tin kênh (nếu có)
        let channelInfo = null;
        if (videoData.snippet.channelId) {
            channelInfo = await fetchChannelInfo(videoData.snippet.channelId, apiKey);
        }
        
        // 4. Phân tích dữ liệu
        const analyzedData = analyzeVideoData(videoData, categoryName, channelInfo);
        
        // 5. Hiển thị kết quả
        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = createTabInterface(analyzedData);
        resultDiv.style.display = 'block';
        
        // 6. Khởi tạo tabs
        setTimeout(initTabs, 100);
        
        console.log('✅ Đã tải xong toàn bộ thông tin!');
        
    } catch (error) {
        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = `
            <div class="error">
                <h3><i class="fas fa-exclamation-triangle"></i> LỖI HỆ THỐNG</h3>
                <p><strong>${error.message}</strong></p>
                <div class="error-details">
                    <h4>Nguyên nhân có thể:</h4>
                    <ul>
                        <li>API Key không hợp lệ hoặc đã hết hạn</li>
                        <li>Video bị xóa hoặc chế độ riêng tư</li>
                        <li>Giới hạn API quota (vượt quá 100 requests/ngày)</li>
                        <li>Vấn đề kết nối mạng</li>
                    </ul>
                    <h4>Cách khắc phục:</h4>
                    <ol>
                        <li>Kiểm tra lại API Key trong Google Cloud Console</li>
                        <li>Đảm bảo video công khai và tồn tại</li>
                        <li>Chờ 24h nếu đã vượt quota miễn phí</li>
                        <li>Thử lại URL YouTube khác</li>
                    </ol>
                </div>
            </div>
        `;
        resultDiv.style.display = 'block';
        console.error('❌ Error:', error);
    }
}

// ============================================
// 8. KHỞI TẠO ỨNG DỤNG
// ============================================

// Thêm sự kiện click cho nút
getInfoBtn.addEventListener('click', getFullVideoInfo);

// Thêm sự kiện Enter cho input
youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        getFullVideoInfo();
    }
});

// Thêm sự kiện paste tự động
youtubeUrlInput.addEventListener('paste', (e) => {
    setTimeout(() => {
        if (apiKeyInput.value) {
            getFullVideoInfo();
        }
    }, 500);
});

// Hướng dẫn khi trang load
console.log('🎬 YouTube Full Info Extractor v2.0');
console.log('📊 Có thể lấy 25+ loại thông tin khác nhau');
console.log('👉 Hướng dẫn: Dán API Key → Dán URL → Click LẤY THÔNG TIN');

// Tự động fill API Key từ localStorage nếu có
window.addEventListener('load', () => {
    const savedApiKey = localStorage.getItem('youtube_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }
    
    // Lưu API Key khi người dùng nhập
    apiKeyInput.addEventListener('change', () => {
        if (apiKeyInput.value.trim()) {
            localStorage.setItem('youtube_api_key', apiKeyInput.value.trim());
        }
    });
});