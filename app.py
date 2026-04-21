from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
import os
import random
import uuid
import firebase_admin
from firebase_admin import credentials, firestore, auth
from functools import wraps
from config import DevelopmentConfig, ProductionConfig

env = os.getenv("FLASK_ENV", "development")

config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig
}

app = Flask(__name__)
app.config.from_object(config_map[env])

app.secret_key = app.config["SECRET_KEY"]

cred = credentials.Certificate(app.config["FIREBASE_CREDENTIALS"])
firebase_admin.initialize_app(cred)
db_firestore = firestore.client()

DATA_FOLDER = 'data'

# --- HELPER PER IL DATABASE UTENTE ---
def get_user_data(user_id):
    """Recupera i dati salvati su Firestore per uno specifico utente"""
    user_ref = db_firestore.collection('users').document(user_id)
    doc = user_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {"inventory": [], "decks": []} # Dati di default

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # Se l'utente non è loggato, lo manda alla pagina di login
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('home'))
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login():
    """Riceve il token da Google (lato frontend) e crea la sessione"""
    id_token = request.json.get('idToken')
    try:
        # Verifica il token inviato dal frontend
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        session['user_id'] = user_id
        session['user_name'] = decoded_token.get('name')
        
        # Inizializza il documento su Firestore se non esiste
        user_ref = db_firestore.collection('users').document(user_id)
        
        user_data = user_ref.get().to_dict()
        if not user_ref.get().exists or "username" not in user_data:
            user_ref.set({
                "name": session['user_name'],
                "inventory": [],
                "created_at": firestore.SERVER_TIMESTAMP,
                "username": None
            }, merge=True)
            
        return jsonify({"status": "success", "user": session['user_name']})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

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

@app.before_request
def check_user():
    # Escludi la pagina di login e le API di login dal controllo, 
    # altrimenti crei un loop infinito!
    if 'user_id' not in session and request.endpoint not in ['login_page', 'login', 'static']:
        return redirect(url_for('login_page'))

# --- NUOVA HOME ---
@app.route('/')
@login_required
def home():
    user = session.get('user_name')
    return render_template('home.html', user=user)

# --- VECCHIA HOME SPOSTATA ---
@app.route('/card-list')
@login_required
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

# --- DECK BUILDER PAGE ---
@app.route('/deck-builder')
@login_required
def deck_builder():
    return render_template('deck_builder.html')
 
# ─────────────────────────────────────────────
#  DECK API
# ─────────────────────────────────────────────
 
@app.route('/api/decks', methods=['GET'])
@login_required
def get_decks():
    """Restituisce tutti i mazzi dell'utente loggato."""
    user_id = session['user_id']
    try:
        decks_ref = db_firestore.collection('users').document(user_id).collection('decks')
        docs = decks_ref.stream()
        decks = []
        for doc in docs:
            d = doc.to_dict()
            d['id'] = doc.id
            decks.append(d)
        return jsonify({"status": "success", "decks": decks})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
 
 
@app.route('/api/decks', methods=['POST'])
@login_required
def create_deck():
    """Crea un nuovo mazzo per l'utente loggato."""
    user_id = session['user_id']
    data = request.get_json()
 
    if not data:
        return jsonify({"status": "error", "message": "Payload mancante"}), 400
 
    name  = data.get('name', 'Nuovo Mazzo').strip()
    cards = data.get('cards', [])
 
    if not name:
        return jsonify({"status": "error", "message": "Il nome del mazzo è obbligatorio"}), 400
 
    total_cards = sum(c.get('count', 1) for c in cards)
    if total_cards > 40:
        return jsonify({"status": "error", "message": "Il mazzo non può superare 40 carte"}), 400
 
    try:
        deck_id  = str(uuid.uuid4())
        deck_ref = (db_firestore
                    .collection('users').document(user_id)
                    .collection('decks').document(deck_id))
        deck_ref.set({
            "name":       name,
            "cards":      cards,
            "equipped":   data.get('equipped', False),
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        return jsonify({"status": "success", "deck_id": deck_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
 
 
@app.route('/api/decks/<deck_id>', methods=['PUT'])
@login_required
def update_deck(deck_id):
    """Aggiorna un mazzo esistente."""
    user_id = session['user_id']
    data = request.get_json()
 
    if not data:
        return jsonify({"status": "error", "message": "Payload mancante"}), 400
 
    name  = data.get('name', '').strip()
    cards = data.get('cards', [])
 
    if not name:
        return jsonify({"status": "error", "message": "Il nome del mazzo è obbligatorio"}), 400
 
    total_cards = sum(c.get('count', 1) for c in cards)
    if total_cards > 40:
        return jsonify({"status": "error", "message": "Il mazzo non può superare 40 carte"}), 400
 
    try:
        deck_ref = (db_firestore
                    .collection('users').document(user_id)
                    .collection('decks').document(deck_id))
 
        if not deck_ref.get().exists:
            return jsonify({"status": "error", "message": "Mazzo non trovato"}), 404
 
        deck_ref.update({
            "name":       name,
            "cards":      cards,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        return jsonify({"status": "success", "deck_id": deck_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
 
 
@app.route('/api/decks/<deck_id>', methods=['DELETE'])
@login_required
def delete_deck(deck_id):
    """Elimina un mazzo."""
    user_id = session['user_id']
    try:
        deck_ref = (db_firestore
                    .collection('users').document(user_id)
                    .collection('decks').document(deck_id))
 
        if not deck_ref.get().exists:
            return jsonify({"status": "error", "message": "Mazzo non trovato"}), 404
 
        deck_ref.delete()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
 
 
@app.route('/api/decks/<deck_id>/equip', methods=['POST'])
@login_required
def equip_deck(deck_id):
    """Equipaggia un mazzo (un solo mazzo può essere equipaggiato alla volta)."""
    user_id = session['user_id']
    try:
        user_ref  = db_firestore.collection('users').document(user_id)
        decks_ref = user_ref.collection('decks')
 
        # Batch: de-equipaggia tutti, poi equipaggia quello scelto
        batch = db_firestore.batch()
 
        for doc in decks_ref.stream():
            batch.update(doc.reference, {"equipped": False})
 
        target_ref = decks_ref.document(deck_id)
        if not target_ref.get().exists:
            return jsonify({"status": "error", "message": "Mazzo non trovato"}), 404
 
        batch.update(target_ref, {"equipped": True})
        batch.commit()
 
        # Salva anche sull'utente il riferimento al mazzo equipaggiato
        user_ref.update({"equipped_deck": deck_id})
 
        return jsonify({"status": "success", "equipped_deck": deck_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
 
@app.route('/set-username')
@login_required
def set_username_page():
    return render_template('set_username.html')

@app.route('/api/set-username', methods=['POST'])
@login_required
def set_username():
    user_id = session['user_id']
    username = request.json.get("username", "").strip()

    if not username:
        return jsonify({"status": "error", "message": "Username required"}), 400

    user_ref = db_firestore.collection('users').document(user_id)

    # controllo base (opzionale ma consigliato)
    if len(username) < 3:
        return jsonify({"status": "error", "message": "Username too short"}), 400

    user_ref.update({
        "username": username
    })

    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(host='localhost')
