from flask import Flask, render_template
import requests
from deep_translator import GoogleTranslator

app = Flask(__name__)

@app.route('/')
def home():
    url = "https://eldenring.fanapis.com/api/bosses"
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
    }
    
    try:
        # verify=False se hai ancora errori SSL, altrimenti toglilo
        response = requests.get(url, headers=headers, timeout=10)
        
        # Controlla se la risposta è valida (Codice 200)
        if response.status_code != 200:
            return f"Errore API: Il server ha risposto con codice {response.status_code}", 500
            
        data = response.json()
    except Exception as e:
        return f"Errore durante la richiesta: {str(e)}", 500

    boss_list = []
    if data.get('data'):
        for boss in data['data']:
            boss_list.append({
                'nome': boss['name'],
                'immagine': boss['image'],
                'descrizione': boss['description'],
                'location': boss['location']
            })
            
    return render_template('index.html', bosses=boss_list)

if __name__ == '__main__':
    app.run(debug=True)
