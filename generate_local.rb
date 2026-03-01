# generate_local.rb
require 'yaml'
require 'json'
require 'date'
require 'time'
require 'fileutils'

# Cấu hình YAML
YAML::DEFAULT_OPTION = { permitted_classes: [Date, Time, Symbol] }

def generate_articles_json
  puts "🔍 Starting article generation..."
  
  articles = []
  posts_dir = '_posts'
  data_dir = '_data'
  assets_data_dir = 'assets/data'
  
  # Kiểm tra thư mục _posts
  unless Dir.exist?(posts_dir)
    puts "❌ Directory #{posts_dir} not found!"
    return false
  end
  
  # Tạo directories nếu chưa tồn tại
  FileUtils.mkdir_p(data_dir)
  FileUtils.mkdir_p(assets_data_dir)
  
  puts "📁 Scanning #{posts_dir} directory..."
  
  # Lấy tất cả files .md và .markdown
  md_files = Dir.glob("#{posts_dir}/*.{md,markdown}")
  puts "📄 Found #{md_files.length} markdown files"
  
  if md_files.empty?
    puts "⚠️ No markdown files found"
    # Tạo file rỗng
    empty_output = {
      'articles' => [],
      'last_updated' => Time.now.iso8601,
      'total' => 0
    }
    File.write("#{data_dir}/articles.json", JSON.pretty_generate(empty_output))
    File.write("#{assets_data_dir}/articles.json", JSON.pretty_generate(empty_output))
    puts "✅ Created empty articles.json files"
    return true
  end
  
  md_files.each do |file|
    begin
      puts "📄 Processing: #{File.basename(file)}"
      content = File.read(file)
      
      if content =~ /^---\s*\n(.*?)\n---\s*\n/m
        frontmatter_str = $1
        
        # Parse frontmatter
        begin
          frontmatter = YAML.safe_load(frontmatter_str, permitted_classes: [Date, Time, Symbol])
        rescue
          frontmatter = YAML.load(frontmatter_str)
        end
        
        filename = File.basename(file, '.*')
        slug = filename
        if slug =~ /^\d{4}-\d{2}-\d{2}-(.+)$/
          slug = $1
        end
        
        # Xử lý ngày tháng
        date_str = case frontmatter['date']
        when Date, Time
          frontmatter['date'].strftime('%Y-%m-%d')
        when String
          begin
            Date.parse(frontmatter['date']).strftime('%Y-%m-%d')
          rescue
            Date.today.strftime('%Y-%m-%d')
          end
        else
          if filename =~ /^(\d{4})-(\d{2})-(\d{2})/
            "#{$1}-#{$2}-#{$3}"
          else
            Date.today.strftime('%Y-%m-%d')
          end
        end
        
        # Lấy description
        description = frontmatter['description'].to_s
        if description.empty? && content.length > 0
          main_content = content.sub(/^---\s*\n.*?\n---\s*\n/m, '').strip
          description = main_content[0..150] + '...' if main_content.length > 0
        end
        
        # Tạo URL
        url = "/learn/#{date_str.gsub('-', '/')}/#{slug}.html"
        
        article = {
          'id' => slug,
          'slug' => slug,
          'url' => url,
          'title' => frontmatter['title'].to_s,
          'description' => description,
          'date' => date_str,
          'author' => frontmatter['author'].to_s.empty? ? 'Bitcoin PeakDip Team' : frontmatter['author'].to_s,
          'category' => frontmatter['category'].to_s.empty? ? 'General' : frontmatter['category'].to_s,
          'reading_time' => frontmatter['reading_time'] || 5,
          'level' => frontmatter['level'].to_s.empty? ? 'Beginner' : frontmatter['level'].to_s,
          'icon' => frontmatter['icon'].to_s.empty? ? 'book' : frontmatter['icon'].to_s,
          'featured' => frontmatter['featured'] || false
        }
        
        articles << article
        puts "  ✅ Added: #{article['title']}"
      else
        puts "  ⚠️ No front matter in #{file}"
      end
    rescue => e
      puts "  ❌ Error: #{e.message}"
    end
  end
  
  # Sắp xếp theo ngày
  articles.sort_by! { |a| a['date'] }.reverse!
  
  output = {
    'articles' => articles,
    'last_updated' => Time.now.iso8601,
    'total' => articles.length
  }
  
  # Ghi file
  File.write("#{data_dir}/articles.json", JSON.pretty_generate(output))
  puts "✅ Wrote to #{data_dir}/articles.json"
  
  File.write("#{assets_data_dir}/articles.json", JSON.pretty_generate(output))
  puts "✅ Wrote to #{assets_data_dir}/articles.json"
  
  puts "🎉 Success! Generated #{articles.length} articles"
  return true
end

# Chạy
generate_articles_json