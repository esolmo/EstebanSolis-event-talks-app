import os
import re
import html
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Feed URL
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for parsed releases
# Format: { 'data': [...], 'timestamp': float }
import time
_cache = {
    'data': None,
    'timestamp': 0
}
CACHE_EXPIRY_SECONDS = 300 # 5 minutes cache

def clean_html_to_text(html_str):
    """
    Strips HTML tags and normalizes whitespace to produce clean plain text.
    Used for creating tweet previews and search indexing.
    """
    if not html_str:
        return ""
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', html_str)
    # Unescape HTML entities (e.g., &amp; -> &, &lt; -> <)
    text = html.unescape(text)
    # Normalize whitespaces/newlines to single spaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_release_content(content_html):
    """
    Parses the CDATA HTML content of a release entry.
    Since Google Cloud feed entries can contain multiple H3 sections (e.g., Feature, Fix, Issue),
    we split them into individual updates for granular selection.
    """
    if not content_html:
        return []
        
    # Match H3 headers: <h3>Category</h3>
    h3_pattern = re.compile(r'<h3>(.*?)</h3>', re.IGNORECASE)
    matches = list(h3_pattern.finditer(content_html))
    
    if not matches:
        # Fallback if no H3 tags exist in the content
        text_content = clean_html_to_text(content_html)
        return [{
            'type': 'Update',
            'html_content': content_html,
            'text_content': text_content
        }]
        
    updates = []
    for i in range(len(matches)):
        start_idx = matches[i].end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(content_html)
        
        category = matches[i].group(1).strip()
        update_html = content_html[start_idx:end_idx].strip()
        text_content = clean_html_to_text(update_html)
        
        updates.append({
            'type': category,
            'html_content': update_html,
            'text_content': text_content
        })
        
    return updates

def fetch_and_parse_feed(force_refresh=False):
    global _cache
    now = time.time()
    
    # Return cache if valid and refresh not forced
    if not force_refresh and _cache['data'] is not None and (now - _cache['timestamp']) < CACHE_EXPIRY_SECONDS:
        return _cache['data'], True
        
    try:
        # Fetch RSS/Atom feed from Google Cloud Feed with a timeout
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlaskReleaseNotesParser/1.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        parsed_items = []
        item_id_counter = 0
        
        for entry in root.findall('atom:entry', ns):
            date_str = entry.find('atom:title', ns).text
            iso_date = entry.find('atom:updated', ns).text
            
            link_el = entry.find('atom:link', ns)
            link = link_el.attrib.get('href', '') if link_el is not None else ''
            
            content_el = entry.find('atom:content', ns)
            content_html = content_el.text if content_el is not None else ''
            
            # Split the release entry into sub-updates (e.g. separate Feature, Fix, etc.)
            sub_updates = parse_release_content(content_html)
            
            for update in sub_updates:
                item_id_counter += 1
                parsed_items.append({
                    'id': f"update-{item_id_counter}",
                    'date': date_str,
                    'iso_date': iso_date,
                    'link': link,
                    'type': update['type'],
                    'html_content': update['html_content'],
                    'text_content': update['text_content']
                })
                
        # Update cache
        _cache['data'] = parsed_items
        _cache['timestamp'] = now
        return parsed_items, False
        
    except Exception as e:
        # Log error and raise it to be handled by the route
        print(f"Error fetching/parsing feed: {str(e)}")
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        releases, from_cache = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            'status': 'success',
            'cached': from_cache,
            'count': len(releases),
            'releases': releases
        })
    except Exception as e:
        # If fetch fails and we have old cached data, fall back to it rather than crashing completely
        if _cache['data'] is not None:
            return jsonify({
                'status': 'fallback',
                'cached': True,
                'error': str(e),
                'count': len(_cache['data']),
                'releases': _cache['data']
            })
        return jsonify({
            'status': 'error',
            'message': f"Failed to fetch release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
