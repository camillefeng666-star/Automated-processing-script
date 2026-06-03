#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
浏览器自动翻页脚本 - Selenium版本
支持多种翻页模式：滚动加载、点击翻页、页码跳转
适用于数据采集、爬虫等场景
"""

import time
import json
import random
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import NoSuchElementException, TimeoutException


@dataclass
class PaginationConfig:
    """翻页配置"""
    mode: str = "scroll"  # scroll(滚动加载) | click(点击翻页) | page_number(页码跳转)
    max_pages: int = 10  # 最大翻页次数
    delay: float = 2.0  # 翻页间隔(秒)
    
    # 滚动模式配置
    scroll_step: int = 800  # 每次滚动像素
    scroll_delay: float = 0.5  # 滚动间隔
    scroll_threshold: int = 200  # 距离底部阈值
    
    # 点击模式配置
    next_button_selector: str = ""  # 下一页按钮CSS选择器
    wait_for_selector: str = ""  # 等待新内容加载的选择器
    
    # 页码模式配置
    page_url_template: str = ""  # 页码URL模板
    start_page: int = 1  # 起始页码


class AutoPaginationSelenium:
    """Selenium自动翻页器"""
    
    def __init__(self, config: PaginationConfig = None):
        self.config = config or PaginationConfig()
        self.driver: Optional[webdriver.Chrome] = None
        self.current_page = 1
        self.collected_data: List[Dict[str, Any]] = []
    
    def init_browser(self, headless: bool = False, proxy: str = None):
        """初始化Chrome浏览器"""
        chrome_options = Options()
        
        if headless:
            chrome_options.add_argument("--headless")
        
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        if proxy:
            chrome_options.add_argument(f"--proxy-server={proxy}")
        
        # 设置User-Agent
        chrome_options.add_argument(
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            '''
        })
        
        print("浏览器初始化完成")
    
    def navigate(self, url: str):
        """导航到指定URL"""
        print(f"正在访问: {url}")
        self.driver.get(url)
        time.sleep(2)
    
    def scroll_pagination(self, extract_callback: Callable = None) -> List[Dict]:
        """滚动加载翻页"""
        print(f"开始滚动加载翻页，最大页数: {self.config.max_pages}")
        
        for page_num in range(self.config.max_pages):
            print(f"\n--- 第 {page_num + 1} 次滚动 ---")
            
            # 记录当前高度
            previous_height = self.driver.execute_script(
                "return document.body.scrollHeight"
            )
            
            # 滚动到页面底部
            self.driver.execute_script(
                f"window.scrollBy(0, {self.config.scroll_step});"
            )
            time.sleep(self.config.scroll_delay)
            
            # 继续滚动直到底部
            scroll_attempts = 0
            max_scroll_attempts = 10
            
            while scroll_attempts < max_scroll_attempts:
                current_height = self.driver.execute_script(
                    "return document.body.scrollHeight"
                )
                scroll_position = self.driver.execute_script(
                    "return window.scrollY + window.innerHeight"
                )
                
                if scroll_position >= current_height - self.config.scroll_threshold:
                    break
                
                self.driver.execute_script(
                    f"window.scrollBy(0, {self.config.scroll_step});"
                )
                time.sleep(self.config.scroll_delay)
                scroll_attempts += 1
            
            # 等待新内容加载
            time.sleep(self.config.delay)
            
            # 检查是否有新内容
            new_height = self.driver.execute_script(
                "return document.body.scrollHeight"
            )
            if new_height == previous_height:
                print("页面高度未变化，可能已到达底部")
                break
            
            # 提取数据
            if extract_callback:
                try:
                    data = extract_callback(self.driver)
                    if data:
                        self.collected_data.extend(data)
                        print(f"提取到 {len(data)} 条数据")
                except Exception as e:
                    print(f"提取数据时出错: {e}")
            
            self.current_page += 1
        
        print(f"\n滚动翻页完成，共滚动 {self.current_page} 次")
        return self.collected_data
    
    def click_pagination(self, extract_callback: Callable = None) -> List[Dict]:
        """点击翻页"""
        if not self.config.next_button_selector:
            raise ValueError("点击翻页模式需要设置 next_button_selector")
        
        print(f"开始点击翻页，最大页数: {self.config.max_pages}")
        print(f"下一页按钮选择器: {self.config.next_button_selector}")
        
        for page_num in range(self.config.max_pages):
            print(f"\n--- 第 {page_num + 1} 页 ---")
            
            # 提取当前页数据
            if extract_callback:
                try:
                    data = extract_callback(self.driver)
                    if data:
                        self.collected_data.extend(data)
                        print(f"提取到 {len(data)} 条数据")
                except Exception as e:
                    print(f"提取数据时出错: {e}")
            
            # 查找下一页按钮
            try:
                next_button = self.driver.find_element(
                    By.CSS_SELECTOR, 
                    self.config.next_button_selector
                )
                
                # 检查按钮是否可用
                if not next_button.is_enabled() or 'disabled' in next_button.get_attribute('class'):
                    print("下一页按钮已禁用，翻页结束")
                    break
                
                # 点击下一页
                print("点击下一页...")
                next_button.click()
                
                # 等待新内容加载
                if self.config.wait_for_selector:
                    WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located(
                            (By.CSS_SELECTOR, self.config.wait_for_selector)
                        )
                    )
                else:
                    time.sleep(self.config.delay)
                
                self.current_page += 1
                
            except NoSuchElementException:
                print("未找到下一页按钮，翻页结束")
                break
            except Exception as e:
                print(f"翻页时出错: {e}")
                break
        
        print(f"\n点击翻页完成，共翻页 {self.current_page} 次")
        return self.collected_data
    
    def page_number_pagination(self, extract_callback: Callable = None) -> List[Dict]:
        """页码跳转翻页"""
        if not self.config.page_url_template:
            raise ValueError("页码翻页模式需要设置 page_url_template")
        
        print(f"开始页码翻页，从第 {self.config.start_page} 页到第 {self.config.max_pages} 页")
        
        for page_num in range(self.config.start_page, self.config.max_pages + 1):
            print(f"\n--- 第 {page_num} 页 ---")
            
            # 构建页码URL
            page_url = self.config.page_url_template.format(page=page_num)
            
            try:
                self.driver.get(page_url)
                time.sleep(self.config.delay)
                
                # 提取数据
                if extract_callback:
                    try:
                        data = extract_callback(self.driver)
                        if data:
                            self.collected_data.extend(data)
                            print(f"提取到 {len(data)} 条数据")
                    except Exception as e:
                        print(f"提取数据时出错: {e}")
                
                self.current_page = page_num
                
            except Exception as e:
                print(f"访问第 {page_num} 页时出错: {e}")
                break
        
        print(f"\n页码翻页完成，共访问 {self.current_page} 页")
        return self.collected_data
    
    def run(self, url: str, extract_callback: Callable = None) -> List[Dict]:
        """运行自动翻页"""
        self.navigate(url)
        
        if self.config.mode == "scroll":
            return self.scroll_pagination(extract_callback)
        elif self.config.mode == "click":
            return self.click_pagination(extract_callback)
        elif self.config.mode == "page_number":
            return self.page_number_pagination(extract_callback)
        else:
            raise ValueError(f"不支持的翻页模式: {self.config.mode}")
    
    def close(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
            print("浏览器已关闭")
    
    def save_data(self, filename: str = "collected_data.json"):
        """保存采集的数据"""
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(self.collected_data, f, ensure_ascii=False, indent=2)
        print(f"数据已保存到: {filename}")


# ==================== 使用示例 ====================

def example_scroll():
    """滚动翻页示例"""
    config = PaginationConfig(
        mode="scroll",
        max_pages=5,
        delay=2.0,
        scroll_step=1000
    )
    
    paginator = AutoPaginationSelenium(config)
    paginator.init_browser(headless=False)
    
    def extract_content(driver):
        """提取内容"""
        items = driver.find_elements(By.CSS_SELECTOR, '.ContentItem-title')
        data = []
        for item in items:
            data.append({"title": item.text})
        return data
    
    try:
        data = paginator.run(
            "https://www.zhihu.com/search?type=content&q=Python",
            extract_content
        )
        print(f"\n总共采集 {len(data)} 条数据")
        paginator.save_data("zhihu_data.json")
    finally:
        paginator.close()


def example_click():
    """点击翻页示例"""
    config = PaginationConfig(
        mode="click",
        max_pages=10,
        delay=3.0,
        next_button_selector="a.next",
        wait_for_selector=".item"
    )
    
    paginator = AutoPaginationSelenium(config)
    paginator.init_browser(headless=False)
    
    def extract_products(driver):
        """提取商品信息"""
        items = driver.find_elements(By.CSS_SELECTOR, '.item')
        data = []
        for item in items:
            try:
                title = item.find_element(By.CSS_SELECTOR, '.title').text
                price = item.find_element(By.CSS_SELECTOR, '.price').text
                data.append({"title": title, "price": price})
            except:
                pass
        return data
    
    try:
        data = paginator.run(
            "https://example-ecommerce.com/products",
            extract_products
        )
        print(f"\n总共采集 {len(data)} 条商品数据")
        paginator.save_data("products.json")
    finally:
        paginator.close()


def example_page_number():
    """页码翻页示例"""
    config = PaginationConfig(
        mode="page_number",
        max_pages=20,
        delay=2.0,
        page_url_template="https://example.com/list?page={page}",
        start_page=1
    )
    
    paginator = AutoPaginationSelenium(config)
    paginator.init_browser(headless=False)
    
    def extract_articles(driver):
        """提取文章信息"""
        items = driver.find_elements(By.CSS_SELECTOR, '.article-item')
        data = []
        for item in items:
            try:
                title = item.find_element(By.TAG_NAME, 'h2').text
                link = item.find_element(By.TAG_NAME, 'a').get_attribute('href')
                data.append({"title": title, "link": link})
            except:
                pass
        return data
    
    try:
        data = paginator.run(
            "https://example.com/list?page=1",
            extract_articles
        )
        print(f"\n总共采集 {len(data)} 篇文章")
        paginator.save_data("articles.json")
    finally:
        paginator.close()


if __name__ == "__main__":
    print("选择翻页模式:")
    print("1. 滚动翻页 (适合无限滚动页面)")
    print("2. 点击翻页 (适合有下一页按钮的页面)")
    print("3. 页码翻页 (适合URL带页码参数的页面)")
    
    choice = input("\n请输入数字 (1-3): ").strip()
    
    if choice == "1":
        example_scroll()
    elif choice == "2":
        example_click()
    elif choice == "3":
        example_page_number()
    else:
        print("无效选择")
