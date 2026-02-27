import os
import google.generativeai as genai

# Use user's key
os.environ["GEMINI_API_KEY"] = "AIzaSyC7omD4yV5oJyuAsqio35wGU_N1115qIs4"
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def run_tests():
    print("Test 1: GenAI protos GoogleSearch object")
    try:
        model = genai.GenerativeModel("gemini-2.5-flash", tools=[genai.protos.Tool(google_search=genai.protos.GoogleSearch())])
        response = model.generate_content("What is the current stock price of Apple?")
        print("Success!")
        return 1
    except Exception as e:
        print(f"Error 1: {e}")

    print("\nTest 2: genai.protos.Tool dict")
    try:
        model = genai.GenerativeModel("gemini-1.5-flash", tools=[{"google_search": {}}])
        response = model.generate_content("What is the current stock price of Apple?")
        print("Success!")
        return 2
    except Exception as e:
        print(f"Error 2: {e}")

run_tests()
