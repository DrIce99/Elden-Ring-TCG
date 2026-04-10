from flask import Flask, render_template, request, jsonify
import json
import os
import random

app = Flask(__name__)

DATA_FOLDER = 'data'

def load_all_data():
    database = {}
    # Carica ogni file .json nella cartella data
    if not os.path.exists(DATA_FOLDER):
        return {}
    
    for filename in os.listdir(DATA_FOLDER):
        if filename.endswith('.json'):
            category = filename.replace('.json', '')
            with open(os.path.join(DATA_FOLDER, filename), 'r', encoding='utf-8') as f:
                try:
                    database[category] = json.load(f)
                except json.JSONDecodeError:
                    print(f"❌ Errore nel file {filename}: formato JSON non valido.")
                    database[category] = []
                
    return database

@app.route('/')
def index():
    db = load_all_data()
    categories = list(db.keys())
    
    sel_cat = request.args.get('category')
    sel_area = request.args.get('area')
    
    filtered_data = []
    
    if sel_cat == "all":
        # Unisce tutti gli elementi di tutte le categorie
        for cat in db:
            filtered_data.extend(db[cat])
        
        # Ordina per ID (convertendo in int per evitare 1, 10, 2)
        filtered_data.sort(key=lambda x: int(x.get('id', 0)))
        
    elif sel_cat in db:
        filtered_data = db[sel_cat]
    
    # Filtro per area (valido sia per "all" che per categoria singola)
    if sel_area:
        filtered_data = [i for i in filtered_data if sel_area.lower() in i.get('banner', '').lower()]
            
    return render_template('index.html', 
                           categories=categories, 
                           items=json.dumps(filtered_data),
                           sel_cat=sel_cat)

# Endpoint per aggiungere nuovi elementi (da implementare via form)
@app.route('/add', methods=['POST'])
def add_item():
    # Qui andrebbe la logica per salvare i nuovi dati nel JSON specifico
    return "Funzionalità da implementare via form", 200


@app.route('/card-designer')
def card_designer():
    db = load_all_data()
    card_type = request.args.get('type', 'character')  

    if card_type == "weapon":
        # Prende sia weapons che shields (entrambi usano il layout arma)
        pool = db.get("weapons", []) + db.get("shields", [])
    
    elif card_type == "character":
        # Per ora carichiamo solo gli NPC come richiesto
        # NOTA: Assicurati che il file si chiami 'npcs.json' o 'npc.json'
        pool = db.get("npcs", [])
    
    elif card_type == "class":
        pool = db.get("classes", [])
    
    else:
        pool = []

    # Seleziona un item casuale o un dizionario vuoto se il pool è vuoto
    random_item = random.choice(pool) if pool else {
        "name": "Nessun dato",
        "img": "",
        "hp": "0",
        "items": []
    }

    return render_template(
        'card_designer.html',
        # Usiamo tojson nel template è più pulito, 
        # ma se preferisci passarlo già serializzato:
        item=random_item, 
        card_type=card_type
    )

if __name__ == '__main__':
    app.run(debug=True)
