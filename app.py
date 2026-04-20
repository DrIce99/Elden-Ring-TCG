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

# --- NUOVA HOME ---
@app.route('/')
def home():
    # Carica semplicemente il menu principale
    return render_template('home.html')

# --- VECCHIA HOME SPOSTATA ---
@app.route('/card-list')
def card_list():
    db = load_all_data()
    categories = list(db.keys())
    
    sel_cat = request.args.get('category')
    sel_area = request.args.get('area')
    
    filtered_data = []
    
    if sel_cat == "all":
        for cat in db:
            filtered_data.extend(db[cat])
        filtered_data.sort(key=lambda x: int(x.get('id', 0)))
        
    elif sel_cat in db:
        filtered_data = db[sel_cat]
        for item in filtered_data:
            item['category'] = sel_cat
    
    if sel_area:
        filtered_data = [i for i in filtered_data if sel_area.lower() in i.get('banner', '').lower()]
            
    return render_template('card_list.html', 
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

    elif card_type == "armor":
        pool = db.get("helmets", []) + db.get("armors", []) + db.get("gloves", []) + db.get("leg_armors", [])
    
    else:
        pool = []
    
    all_items = []

    for key in db:
        all_items.extend(db[key])

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
        card_type=card_type,
        all_items=all_items
    )

@app.route('/table-designer')
def table_designer():
    db = load_all_data()
    
    # 1. Uniamo tutte le carte in un unico pool
    # Puoi decidere di escludere le 'classes' se non sono carte giocabili
    all_cards_pool = (
        db.get("weapons", []) + 
        db.get("classes", []) + 
        db.get("npcs", []) +
        db.get("helmets", []) +
        db.get("armors", []) +
        db.get("leg_armors", []) +
        db.get("gloves", [])
    )

    # 2. Pesca 10 carte casuali dal pool
    # Se hai meno di 10 carte nel DB, usiamo len(pool) per evitare errori
    num_to_draw = 15
    
    # random.sample garantisce che non ci siano duplicati (se possibile)
    # Se vuoi permettere duplicati usa random.choices
    deck_items = random.choices(all_cards_pool, k=num_to_draw)

    # 3. Passiamo la lista al template
    return render_template(
        'table_designer.html', 
        deck=deck_items
    )

@app.route('/api/all')
def api_all():
    db = load_all_data()

    category = request.args.get('category')
    area = request.args.get('area')

    all_items = []

    for cat, items in db.items():
        for item in items:
            item['category'] = cat

            # filtro categoria
            if category and category != "all" and cat != category:
                continue

            # filtro area
            if area and area.lower() not in item.get('banner', '').lower():
                continue

            all_items.append(item)

    all_items.sort(key=lambda x: int(x.get('id', 0)))

    return jsonify({'items': all_items})

@app.route('/card/<card_id>')
def card_detail(card_id):
    """Pagina dettaglio singola carta"""
    db = load_all_data()
    card = None
    category = request.args.get('category', '')
    
    # Cerca la carta nei vari file
    search_categories = [category] if category else list(db.keys())
    
    for cat in search_categories:
        for item in db.get(cat, []):
            if str(item.get('id')) == str(card_id):
                card = item.copy()
                card['category'] = cat
                break
        if card:
            break
    
    if not card:
        return "Carta non trovata", 404
    
    card_type = "character"

    if 'attack' in card:
        card_type = "weapon"
    elif 'dmgNegation' in card:
        card_type = "armor"
    elif 'stats' in card:
        card_type = "class"
    
    return render_template('card_detail.html', card=card, card_type=card_type)

if __name__ == '__main__':
    app.run(debug=True)
