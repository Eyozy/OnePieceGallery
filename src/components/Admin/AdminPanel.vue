<script setup>
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';

// Authentication state
const isAuthenticated = ref(false);
const passwordInput = ref('');
const loginError = ref('');
const loginLoading = ref(false);

const url = ref('');
const loading = ref(false);
const message = ref('');
const status = ref(''); // 'success' | 'error' | ''
const previewData = ref(null);
const galleryItems = ref([]);
const showDeleteConfirm = ref(null);

// Check session on mount
const checkSession = () => {
  const session = sessionStorage.getItem('admin_authenticated');
  if (session === 'true') {
    isAuthenticated.value = true;
  }
};

// Login handler
const handleLogin = async () => {
  if (!passwordInput.value) {
    loginError.value = '请输入密码';
    return;
  }
  
  loginLoading.value = true;
  loginError.value = '';
  
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      isAuthenticated.value = true;
      sessionStorage.setItem('admin_authenticated', 'true');
      fetchGalleryItems();
    } else {
      loginError.value = data.message || '密码错误';
    }
  } catch (e) {
    loginError.value = '验证失败，请重试';
  } finally {
    loginLoading.value = false;
  }
};

// Logout handler
const handleLogout = () => {
  isAuthenticated.value = false;
  sessionStorage.removeItem('admin_authenticated');
  passwordInput.value = '';
};

// Fetch existing gallery items
const fetchGalleryItems = async () => {
  try {
    const response = await fetch('/api/list');
    if (response.ok) {
      const data = await response.json();
      const rawItems = data.items || [];
      galleryItems.value = rawItems.map(item => ({
        ...item,
        // Use GitHub raw URL for production, fallback to local path for dev
        image: item.imageUrl || (item.image ? item.image.replace('../../', '/src/') : '')
      }));
    }
  } catch (e) {
    console.log('Could not fetch gallery items');
  }
};

onMounted(() => {
  checkSession();
  if (isAuthenticated.value) {
    fetchGalleryItems();
  }
});

const fetchPreview = async () => {
  if (!url.value) return;
  loading.value = true;
  message.value = '';
  previewData.value = null;

  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.value }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '获取预览失败');
    
    previewData.value = data;

    if (data.isError) {
      status.value = 'error';
      message.value = data.message;
    }
  } catch (e) {
    status.value = 'error';
    message.value = e.message;
  } finally {
    loading.value = false;
  }
};

const submitImage = async () => {
  if (!previewData.value) return;
  
  loading.value = true;
  message.value = '';
  
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewData.value),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '上传失败');
    
    status.value = 'success';
    message.value = '保存成功！请刷新查看。';
    url.value = '';
    previewData.value = null;
    fetchGalleryItems(); // Refresh list
  } catch (e) {
    status.value = 'error';
    message.value = e.message;
  } finally {
    loading.value = false;
  }
};

const deleteItem = async (slug) => {
  loading.value = true;
  message.value = '';
  
  try {
    const response = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '删除失败');
    
    status.value = 'success';
    message.value = '删除成功！';
    showDeleteConfirm.value = null;
    fetchGalleryItems(); // Refresh list
  } catch (e) {
    status.value = 'error';
    message.value = e.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <!-- Login Screen -->
  <div v-if="!isAuthenticated" class="login-container">
    <div class="login-card">
      <div class="login-icon">
        <Icon icon="mdi:shield-lock-outline" />
      </div>
      <h2>管理员验证</h2>
      <p>请输入管理员密码以访问后台</p>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="login-input-wrapper">
          <Icon icon="mdi:key-variant" class="input-icon" />
          <input 
            v-model="passwordInput" 
            type="password" 
            placeholder="输入密码..." 
            :disabled="loginLoading"
            autocomplete="current-password"
          />
        </div>
        
        <div v-if="loginError" class="login-error">
          <Icon icon="mdi:alert-circle" />
          {{ loginError }}
        </div>
        
        <button type="submit" class="btn-login" :disabled="loginLoading">
          <Icon v-if="loginLoading" icon="mdi:loading" class="spin" />
          <span v-else>进入管理后台</span>
        </button>
      </form>
    </div>
  </div>

  <!-- Admin Panel (when authenticated) -->
  <div v-else class="admin-panel">
    <div class="header-section">
      <div class="header-top">
        <div>
          <h2>藏品管理</h2>
          <p>添加来自 X (Twitter) 或 Instagram 的新宝藏，或管理现有收藏。</p>
        </div>
        <button @click="handleLogout" class="btn-logout">
          <Icon icon="mdi:logout" />
          退出登录
        </button>
      </div>
    </div>

    <!-- Input Section -->
    <div class="section-card add-card">
      <div class="card-header">
        <Icon icon="mdi:plus-circle-outline" class="card-icon" />
        <h3>添加新宝藏</h3>
      </div>
      
      <div class="input-area">
        <div class="input-wrapper">
          <input 
            v-model="url" 
            type="text" 
            placeholder="粘贴链接 (https://x.com/...)" 
            @keyup.enter="fetchPreview"
            :disabled="loading"
          />
          <button @click="fetchPreview" :disabled="loading || !url" class="btn-primary">
            <span v-if="!loading">获取预览</span>
            <Icon icon="mdi:loading" class="spin" v-else />
          </button>
        </div>
        
        <div v-if="message" :class="['status-msg', status]">
          <Icon :icon="status === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'" />
          {{ message }}
        </div>
      </div>
    </div>

    <!-- Preview Section -->
    <div v-if="previewData" class="section-card preview-section">
      <div class="preview-layout">
        <div class="preview-media">
          <img v-if="previewData.imageUrl" :src="previewData.imageUrl" alt="Preview" />
          <div v-else class="placeholder-image">
             <Icon icon="mdi:image-off" size="48" />
             <span>无图片预览</span>
          </div>
        </div>
        
        <div class="preview-details">
          <h3>确认信息</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>标题</label>
              <input v-model="previewData.title" placeholder="输入标题..." />
            </div>
            <div class="form-group">
              <label>作者 (@ID)</label>
              <div class="input-with-prefix">
                <span>@</span>
                <input v-model="previewData.author" placeholder="username" />
              </div>
            </div>
            <div v-if="previewData.isError" class="form-group full-width">
              <label>图片链接 (手动修正)</label>
              <input v-model="previewData.imageUrl" placeholder="https://..." />
            </div>
          </div>
          
          <div class="action-buttons">
            <button @click="submitImage" class="btn-success" :disabled="loading">
              <Icon icon="mdi:content-save-check" /> 确认保存
            </button>
            <button @click="previewData = null" class="btn-ghost">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- List Section -->
    <div v-if="galleryItems.length > 0" class="manage-section">
      <div class="section-header">
        <h3>现有藏品 <span class="badge">{{ galleryItems.length }}</span></h3>
      </div>
      
      <div class="gallery-grid">
        <div v-for="item in galleryItems" :key="item.slug" class="gallery-card">
          <div class="card-thumb">
            <img :src="item.image" loading="lazy" :alt="item.title" />
            <div class="thumb-overlay">
                <a :href="item.originalUrl" target="_blank" class="link-icon">
                    <Icon icon="mdi:external-link" />
                </a>
            </div>
          </div>
          
          <div class="card-content">
            <div class="card-info">
              <h4>{{ item.title || item.slug }}</h4>
              <span class="author">@{{ item.author }}</span>
            </div>
            
            <div class="card-actions">
               <div v-if="showDeleteConfirm === item.slug" class="confirm-delete">
                  <span>确认?</span>
                  <button @click="deleteItem(item.slug)" class="btn-danger-xs" :disabled="loading">删</button>
                  <button @click="showDeleteConfirm = null" class="btn-ghost-xs">撤</button>
               </div>
               <button 
                  v-else
                  @click="showDeleteConfirm = item.slug" 
                  class="btn-icon delete"
                  title="删除此项"
               >
                  <Icon icon="mdi:trash-can-outline" />
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Login Screen */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  padding: 20px;
}

.login-card {
  background: var(--bg-card);
  border-radius: 24px;
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
  padding: 48px 40px;
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.login-icon {
  font-size: 3.5rem;
  color: var(--accent-blue);
  margin-bottom: 20px;
}

.login-card h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 8px;
}

.login-card > p {
  color: var(--text-muted);
  margin-bottom: 32px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.login-input-wrapper .input-icon {
  position: absolute;
  left: 16px;
  color: var(--text-muted);
  font-size: 1.2rem;
}

.login-input-wrapper input {
  width: 100%;
  padding: 14px 16px 14px 48px;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-main);
  font-size: 1rem;
  transition: all 0.2s;
}

.login-input-wrapper input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
}

.login-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #dc2626;
  font-size: 0.9rem;
  padding: 10px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
}

.btn-login {
  background: var(--accent-blue);
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-login:hover:not(:disabled) {
  background: #0ea5e9;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Admin Panel */
.admin-panel {
  width: 100%;
  max-width: 100%; /* Match parent container width (1200px) */
  margin: 0 auto;
  padding: 0;
}

.header-section {
  margin-bottom: 40px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.header-top > div {
  text-align: left;
}

.header-section h2 {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 10px;
}

.header-section p {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.btn-logout {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-logout:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

/* Cards Common */
.section-card {
  background: var(--bg-card);
  border-radius: 20px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  margin-bottom: 30px;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-header);
}

.card-icon {
  font-size: 1.5rem;
  color: var(--accent-blue);
}

.card-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

/* Add Card */
.add-card .input-area {
  padding: 24px;
}

.input-wrapper {
  display: flex;
  gap: 12px;
}

input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-page);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 1rem;
  transition: all 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
}

.btn-primary {
  background: var(--accent-blue);
  color: white;
  border: none;
  padding: 0 24px;
  border-radius: 10px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #0ea5e9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Preview Section */
.preview-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 0;
}

@media (max-width: 768px) {
  .preview-layout {
    grid-template-columns: 1fr;
  }
}

.preview-media {
  background: #000;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--border-color);
}

.preview-media img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 8px;
}

.preview-details {
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.preview-details h3 {
  margin-bottom: 20px;
  color: var(--text-main);
  font-size: 1.1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.full-width {
  grid-column: span 2;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .full-width {
    grid-column: span 1;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

.input-with-prefix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-prefix span {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.input-with-prefix input {
  padding-left: 32px;
}

.action-buttons {
  margin-top: auto;
  display: flex;
  gap: 12px;
}

.btn-success {
  background: #10b981;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  flex: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.1s;
}

.btn-success:hover {
  background: #059669;
}

.btn-success:active {
    transform: scale(0.98);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 12px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ghost:hover {
  background: var(--bg-page);
  color: var(--text-main);
  border-color: var(--text-muted);
}

/* Gallery List */
.manage-section {
  margin-top: 40px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.section-header h3 {
  font-size: 1.5rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  background: var(--accent-blue);
  color: white;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 12px;
  vertical-align: middle;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.gallery-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.gallery-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1);
  border-color: var(--accent-blue);
}

.card-thumb {
  height: 200px;
  background: #000;
  position: relative;
  overflow: hidden;
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.gallery-card:hover .card-thumb img {
  transform: scale(1.05);
}

.thumb-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.3);
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.gallery-card:hover .thumb-overlay {
    opacity: 1;
}

.link-icon {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    backdrop-filter: blur(4px);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none; /* Ensure no underline */
}

.link-icon:hover {
    background: rgba(255, 255, 255, 0.35);
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.card-content {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
}

.card-info {
    flex: 1;
    min-width: 0; /* Truncate fix */
}

.card-info h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.card-info .author {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.card-actions {
    flex-shrink: 0;
    margin-left: 10px;
}

.btn-icon.delete {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s;
}

.btn-icon.delete:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

/* Status Messages */
.status-msg {
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 0.95rem;
}

.status-msg.success {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.status-msg.error {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin { 
  100% { transform: rotate(360deg); } 
}

/* Confirm Delete */
.confirm-delete {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: #ef4444;
}

.btn-danger-xs {
    background: #ef4444;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
}

.btn-ghost-xs {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
}

/* Responsive Design */
@media (max-width: 768px) {
  .login-card {
    padding: 36px 28px;
  }

  .header-top {
    flex-direction: column;
    text-align: center;
  }

  .header-top > div {
    text-align: center;
  }

  .btn-logout {
    align-self: center;
  }

  .preview-layout {
    grid-template-columns: 1fr;
  }

  .preview-media {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 15px;
    min-height: 40vh;
  }

  .login-card {
    padding: 28px 20px;
    border-radius: 20px;
  }

  .login-icon {
    font-size: 2.8rem;
  }

  .login-card h2 {
    font-size: 1.5rem;
  }

  .header-section h2 {
    font-size: 1.6rem;
  }

  .header-section p {
    font-size: 0.95rem;
  }

  .section-card {
    border-radius: 16px;
  }

  .card-header {
    padding: 16px 18px;
  }

  .add-card .input-area {
    padding: 16px;
  }

  .input-wrapper {
    flex-direction: column;
  }

  .btn-primary {
    width: 100%;
    justify-content: center;
    padding: 12px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: span 1;
  }

  .preview-details {
    padding: 16px;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-success, .btn-ghost {
    width: 100%;
    justify-content: center;
  }

  .gallery-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .section-header h3 {
    font-size: 1.25rem;
  }
}
</style>
