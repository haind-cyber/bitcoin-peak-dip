# generate_local.rb - Version 3.0.0
# Tương thích với cấu trúc articles.json mới (metadata + stats)
require 'yaml'
require 'json'
require 'date'
require 'time'
require 'fileutils'

# Cấu hình YAML
YAML::DEFAULT_OPTION = { permitted_classes: [Date, Time, Symbol] }

def generate_articles_json
  puts "🔍 Starting article generation v3.0.0..."
  puts "=" * 50
  
  articles = []
  posts_dir = '_posts'
  
  # Đọc version từ _config.yml
  config = YAML.load_file('_config.yml')
  current_version = config['version'] || '1.12.15'
  
  # Đường dẫn - ghi vào thư mục gốc
  root_data_dir = '_data'
  root_assets_dir = 'assets/data'
  
  # Đường dẫn trong _site (nếu đã build)
  site_data_dir = '_site/_data'
  site_assets_dir = '_site/assets/data'
  
  # Kiểm tra thư mục _posts
  unless Dir.exist?(posts_dir)
    puts "❌ Directory #{posts_dir} not found!"
    return false
  end
  
  # Tạo directories trong thư mục gốc
  FileUtils.mkdir_p(root_data_dir)
  FileUtils.mkdir_p(root_assets_dir)
  puts "✅ Created directories in root"
  
  puts "📁 Scanning #{posts_dir} directory..."
  
  # Lấy tất cả files .md và .markdown
  md_files = Dir.glob("#{posts_dir}/*.{md,markdown}")
  puts "📄 Found #{md_files.length} markdown files"
  puts "-" * 50
  
  if md_files.empty?
    puts "⚠️ No markdown files found"
    create_empty_files(root_data_dir, root_assets_dir, site_data_dir, site_assets_dir, current_version)
    return true
  end
  
  # Đếm ID để tránh trùng lặp
  seen_ids = {}
  
  md_files.each_with_index do |file, index|
    begin
      filename = File.basename(file)
      puts "[#{index + 1}/#{md_files.length}] Processing: #{filename}"
      
      content = File.read(file)
      
      if content =~ /^---\s*\n(.*?)\n---\s*\n/m
        frontmatter_str = $1
        
        # Parse frontmatter
        begin
          frontmatter = YAML.safe_load(frontmatter_str, permitted_classes: [Date, Time, Symbol])
        rescue => e
          puts "  ⚠️ YAML parse error: #{e.message}, trying regular load..."
          frontmatter = YAML.load(frontmatter_str)
        end
        
        filename_without_ext = File.basename(file, '.*')
        slug = filename_without_ext
        if slug =~ /^\d{4}-\d{2}-\d{2}-(.+)$/
          slug = $1
        end
        
        # Kiểm tra trùng lặp ID
        if seen_ids[slug]
          puts "  ⚠️ Duplicate ID found: #{slug} - skipping"
          next
        end
        seen_ids[slug] = true
        
        # Xử lý ngày tháng
        date_str = extract_date(file, frontmatter, filename_without_ext)
        
        # Lấy description và excerpt
        description = extract_description(frontmatter, content)
        excerpt = extract_excerpt(content)
        
        # Tạo URL
        url = "/learn/#{date_str.gsub('-', '/')}/#{slug}.html"
        
        article = {
          'id' => slug,
          'title' => frontmatter['title'].to_s.strip,
          'description' => description,
          'excerpt' => excerpt,
          'url' => url,
          'date' => date_str,
          'author' => frontmatter['author'].to_s.empty? ? 'Bitcoin PeakDip Team' : frontmatter['author'].to_s.strip,
          'category' => frontmatter['category'].to_s.empty? ? 'General' : frontmatter['category'].to_s.strip,
          'reading_time' => frontmatter['reading_time'] || 5,
          'level' => frontmatter['level'].to_s.empty? ? 'Beginner' : frontmatter['level'].to_s.strip,
          'icon' => frontmatter['icon'].to_s.empty? ? 'book' : frontmatter['icon'].to_s.strip,
          'featured' => frontmatter['featured'] || false
        }
        
        articles << article
        puts "  ✅ Added: #{article['title']} (ID: #{slug})"
      else
        puts "  ⚠️ No front matter found, skipping"
      end
    rescue => e
      puts "  ❌ Error: #{e.message}"
      puts "  Backtrace: #{e.backtrace.first}"
    end
    puts "-" * 30
  end
  
  if articles.empty?
    puts "❌ No articles found!"
    create_empty_files(root_data_dir, root_assets_dir, site_data_dir, site_assets_dir, current_version)
    return false
  end
  
  # Sắp xếp theo ngày (mới nhất lên đầu)
  articles.sort_by! { |a| a['date'] }.reverse!
  
  # Tính toán thống kê
  seven_days_ago = Date.today - 7
  new_articles = articles.select { |a| Date.parse(a['date']) >= seven_days_ago }
  
  # Thống kê theo category
  categories = {}
  articles.each do |a|
    cat = a['category']
    categories[cat] = (categories[cat] || 0) + 1
  end
  
  # Thống kê theo level
  levels = {
    'Beginner' => 0,
    'Intermediate' => 0,
    'Advanced' => 0
  }
  articles.each do |a|
    level = a['level']
    levels[level] = (levels[level] || 0) + 1
  end
  
  # Tạo output với cấu trúc mới
  output = {
    'articles' => articles,
    'metadata' => {
      'last_updated' => Time.now.iso8601,
      'total' => articles.length,
      'version' => current_version,
      'build_timestamp' => (Time.now.to_f * 1000).to_i,
      'build_date' => Date.today.to_s,
      'build_time' => Time.now.strftime('%H:%M:%S')
    },
    'stats' => {
      'new_articles_count' => new_articles.length,
      'new_articles' => new_articles.map { |a| 
        {
          'id' => a['id'],
          'title' => a['title'],
          'url' => a['url'],
          'date' => a['date'],
          'reading_time' => a['reading_time'],
          'level' => a['level']
        }
      },
      'categories' => categories,
      'levels' => levels,
      'featured_count' => articles.count { |a| a['featured'] }
    }
  }
  
  json_output = JSON.pretty_generate(output)
  
  # GHI VÀO THƯ MỤC GỐC
  root_data_file = File.join(root_data_dir, 'articles.json')
  File.write(root_data_file, json_output)
  puts "✅ Wrote to #{root_data_file} (#{articles.length} articles)"
  
  root_assets_file = File.join(root_assets_dir, 'articles.json')
  File.write(root_assets_file, json_output)
  puts "✅ Wrote to #{root_assets_file} (#{articles.length} articles)"
  
  # GHI VÀO _site NẾU TỒN TẠI
  if Dir.exist?('_site')
    FileUtils.mkdir_p(site_data_dir)
    FileUtils.mkdir_p(site_assets_dir)
    
    site_data_file = File.join(site_data_dir, 'articles.json')
    File.write(site_data_file, json_output)
    puts "✅ Wrote to #{site_data_file}"
    
    site_assets_file = File.join(site_assets_dir, 'articles.json')
    File.write(site_assets_file, json_output)
    puts "✅ Wrote to #{site_assets_file}"
  else
    puts "ℹ️ _site directory not found, skipping production copy"
  end
  
  puts "=" * 50
  puts "🎉 Success! Generated #{articles.length} articles"
  puts "📅 Last updated: #{output['metadata']['last_updated']}"
  puts "📊 New articles (7 days): #{new_articles.length}"
  puts "📊 Categories: #{categories.keys.length}"
  puts "📊 Featured: #{output['stats']['featured_count']}"
  
  return true
end

def extract_excerpt(content, max_length = 200)
  # Lấy phần content sau frontmatter
  main_content = content.sub(/^---\s*\n.*?\n---\s*\n/m, '').strip
  
  # Xóa HTML tags nếu có
  plain_text = main_content.gsub(/<[^>]*>/, '')
  
  # Xóa markdown links
  plain_text = plain_text.gsub(/\[([^\]]+)\]\([^\)]+\)/, '\1')
  
  # Lấy đoạn đầu tiên
  excerpt = plain_text.split("\n\n")[0] || plain_text
  
  # Cắt độ dài
  if excerpt.length > max_length
    excerpt = excerpt[0...max_length].gsub(/\s+\S*$/, '...')
  end
  
  excerpt.strip
end

def extract_date(file, frontmatter, filename)
  case frontmatter['date']
  when Date, Time
    frontmatter['date'].strftime('%Y-%m-%d')
  when String
    begin
      Date.parse(frontmatter['date']).strftime('%Y-%m-%d')
    rescue
      extract_date_from_filename(filename) || Date.today.strftime('%Y-%m-%d')
    end
  else
    extract_date_from_filename(filename) || Date.today.strftime('%Y-%m-%d')
  end
end

def extract_date_from_filename(filename)
  if filename =~ /^(\d{4})-(\d{2})-(\d{2})/
    "#{$1}-#{$2}-#{$3}"
  else
    nil
  end
end

def extract_description(frontmatter, content)
  description = frontmatter['description'].to_s.strip
  if description.empty? && content.length > 0
    main_content = content.sub(/^---\s*\n.*?\n---\s*\n/m, '').strip
    description = main_content[0..150].gsub(/\s\w+$/, '...') if main_content.length > 0
  end
  description
end

def create_empty_files(root_data_dir, root_assets_dir, site_data_dir, site_assets_dir, version)
  empty_output = {
    'articles' => [],
    'metadata' => {
      'last_updated' => Time.now.iso8601,
      'total' => 0,
      'version' => version,
      'build_timestamp' => (Time.now.to_f * 1000).to_i,
      'build_date' => Date.today.to_s,
      'build_time' => Time.now.strftime('%H:%M:%S')
    },
    'stats' => {
      'new_articles_count' => 0,
      'new_articles' => [],
      'categories' => {},
      'levels' => {
        'Beginner' => 0,
        'Intermediate' => 0,
        'Advanced' => 0
      },
      'featured_count' => 0
    }
  }
  json_output = JSON.pretty_generate(empty_output)
  
  # Ghi vào thư mục gốc
  File.write(File.join(root_data_dir, 'articles.json'), json_output)
  File.write(File.join(root_assets_dir, 'articles.json'), json_output)
  
  # Ghi vào _site nếu tồn tại
  if Dir.exist?('_site')
    FileUtils.mkdir_p(site_data_dir)
    FileUtils.mkdir_p(site_assets_dir)
    File.write(File.join(site_data_dir, 'articles.json'), json_output)
    File.write(File.join(site_assets_dir, 'articles.json'), json_output)
  end
  
  puts "✅ Created empty articles.json files with metadata"
end

# ===== MAIN =====
puts "\n" + "=" * 50
puts "📄 ARTICLE GENERATOR v3.0.0"
puts "=" * 50

if generate_articles_json
  puts "\n✅ Generation completed successfully!"
  exit 0
else
  puts "\n❌ Generation failed!"
  exit 1
end