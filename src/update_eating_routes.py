import os
import glob
import re

def main():
    base_dir = r"d:\MFU-Longevity-Passport-main\MFU-Longevity-Passport-main\src"
    
    # 1. Update PageType everywhere
    page_type_pattern = re.compile(r"(type PageType =([\s\S]*?)(?:'settings'|'mental-health');)")
    
    for ext in ["*.tsx", "*.ts"]:
        for filepath in glob.glob(os.path.join(base_dir, "**", ext), recursive=True):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            new_content = content
            
            # Find and append the new eating routes
            def replacer(match):
                full_match = match.group(0)
                if "'eating-food-log'" not in full_match:
                    return full_match.rstrip(';') + " | 'eating-food-log' | 'eating-macros' | 'eating-water' | 'eating-schedule' | 'eating-history';"
                return full_match
                
            new_content = page_type_pattern.sub(replacer, new_content)
            
            if content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated PageType in {filepath}")

    # 2. Update App.tsx renderPage
    app_tsx = os.path.join(base_dir, "App.tsx")
    with open(app_tsx, 'r', encoding='utf-8') as f:
        app_content = f.read()
        
    if "case 'eating-food-log':" not in app_content:
        # insert the cases
        cases_to_add = """
      case 'eating':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="dashboard" />
      case 'eating-food-log':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="food-log" />
      case 'eating-macros':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="macros" />
      case 'eating-water':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="water" />
      case 'eating-schedule':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="schedule" />
      case 'eating-history':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="history" />
        """
        
        # Replace the old eating case
        app_content = re.sub(
            r"case 'eating':\s+return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={\(\) => setShowFoodRecognition\(true\)} />",
            cases_to_add.strip(),
            app_content
        )
        
        with open(app_tsx, 'w', encoding='utf-8') as f:
            f.write(app_content)
        print("Updated App.tsx routes")

if __name__ == "__main__":
    main()
