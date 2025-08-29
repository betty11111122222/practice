  // 汉堡菜单切换
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
    
    // 点击菜单项后关闭菜单（针对移动设备）
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
      });
    });
