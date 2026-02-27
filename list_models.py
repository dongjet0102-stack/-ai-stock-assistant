import os
import google.generativeai as genai

os.environ["GEMINI_API_KEY"] = "AIzaSyC7omD4yV5oJyuAsqio35wGU_N1115qIs4"
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
