/* Recipe Finder — enhanced version
   Features: dark mode, favorites, simulated cook time, mock nutrition, share
*/

const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const recipeContainer = document.getElementById('recipeContainer');
const modal = document.getElementById('recipeModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');
const randomBtn = document.getElementById('randomBtn');

const favoritesBtn = document.getElementById('favoritesBtn');
const favoritesModal = document.getElementById('favoritesModal');
const favoritesList = document.getElementById('favoritesList');
const closeFavorites = document.getElementById('closeFavorites');
const noFavsMsg = document.getElementById('noFavsMsg');
const favCount = document.getElementById('favCount');

const themeToggle = document.getElementById('themeToggle');

const cardTpl = document.getElementById('cardTpl');

const API_SEARCH = 'https://www.themealdb.com/api/json/v1/1/search.php?s=';
const API_RANDOM = 'https://www.themealdb.com/api/json/v1/1/random.php';

// -- localStorage keys
const LS_FAV_KEY = 'rt_favorites_v1';
const LS_THEME_KEY = 'rt_theme_v1';

// load favorites from localStorage
let favorites = loadFavorites();
updateFavCount();

// load theme
applySavedTheme();

// utilities: generate cooking time and nutrition (mock)
function genCookTime(){
  return `${Math.floor(Math.random() * 76) + 15} min`; // 15 - 90
}
function genNutrition(){
  // simple mock: calories 180-900, protein 5-50g, fat 3-40g, carbs 10-120g
  return {
    calories: Math.floor(Math.random()*721)+180,
    protein: Math.floor(Math.random()*46)+5,
    fat: Math.floor(Math.random()*38)+3,
    carbs: Math.floor(Math.random()*111)+10
  };
}

// fetch functions
async function fetchRecipes(query){
  try{
    const res = await fetch(API_SEARCH + encodeURIComponent(query));
    const data = await res.json();
    return data.meals;
  }catch(e){
    console.error('Fetch error', e);
    return null;
  }
}
async function fetchRandom(){
  try{
    const res = await fetch(API_RANDOM);
    const data = await res.json();
    return data.meals ? data.meals[0] : null;
  }catch(e){console.error(e); return null}
}

// render a list of meals
function renderRecipes(meals){
  recipeContainer.innerHTML = '';
  if(!meals || meals.length === 0){
    recipeContainer.innerHTML = `<p class="muted">No recipes found. Try other keywords.</p>`;
    return;
  }
  meals.forEach(meal => {
    const node = createCard(meal);
    recipeContainer.appendChild(node);
  });
}

// create a single card element
function createCard(meal){
  const tpl = cardTpl.content.cloneNode(true);
  const card = tpl.querySelector('.card');
  const img = tpl.querySelector('.thumb');
  const title = tpl.querySelector('.card-title');
  const cooktime = tpl.querySelector('.cooktime');
  const favBtn = tpl.querySelector('.fav-btn');
  const viewBtn = tpl.querySelector('.view-btn');

  img.src = meal.strMealThumb;
  img.alt = meal.strMeal;
  title.textContent = meal.strMeal;
  if(!meal._cookTime) meal._cookTime = genCookTime();
  if(!meal._nutrition) meal._nutrition = genNutrition();

  cooktime.textContent = meal._cookTime;

  if(isFavorited(meal.idMeal)) {
    favBtn.classList.add('saved');
    favBtn.textContent = '❤️';
  } else {
    favBtn.textContent = '🤍';
  }

  favBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(meal, favBtn);
  });

  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openRecipeModal(meal);
  });

  card.addEventListener('click', () => openRecipeModal(meal));

  return tpl;
}

// Open recipe modal, render details
function openRecipeModal(meal){
  if(!meal._cookTime) meal._cookTime = genCookTime();
  if(!meal._nutrition) meal._nutrition = genNutrition();

  const ing = [];
  for(let i=1;i<=20;i++){
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if(name && name.trim()) ing.push(`${name} — ${measure || ''}`);
  }

  const youtube = meal.strYoutube || '';
  const source = meal.strSource || '';
  const shareText = `${meal.strMeal}\nCooking time: ${meal._cookTime}\n${youtube ? 'YouTube: '+youtube : ''}\n\nTry it on Recipe Finder!`;

  modalBody.innerHTML = `
    <h2>${escapeHtml(meal.strMeal)}</h2>
    <img src="${meal.strMealThumb}" alt="${escapeHtml(meal.strMeal)}" />
    <div class="meta-row">
      <div><strong>Category:</strong> ${meal.strCategory || '—'}</div>
      <div><strong>Area:</strong> ${meal.strArea || '—'}</div>
      <div><strong>Cook:</strong> ${meal._cookTime}</div>
    </div>

    <h4>Ingredients</h4>
    <ul class="ingredients">${ing.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>

    <h4>Instructions</h4>
    <p>${escapeHtml(meal.strInstructions || '—')}</p>

    <div class="nutrition">
      <div class="nut"><strong>${meal._nutrition.calories}</strong><div class="muted">kcal</div></div>
      <div class="nut"><strong>${meal._nutrition.protein}g</strong><div class="muted">protein</div></div>
      <div class="nut"><strong>${meal._nutrition.fat}g</strong><div class="muted">fat</div></div>
      <div class="nut"><strong>${meal._nutrition.carbs}g</strong><div class="muted">carbs</div></div>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button id="shareBtn" class="primary">🔗 Share</button>
      <a ${youtube ? `href="${youtube}" target="_blank" rel="noopener"` : ''} class="secondary" style="text-decoration:none;padding:10px;border-radius:8px">${youtube ? 'Watch Video' : 'No Video'}</a>
      <button id="modalFavBtn" class="primary">${isFavorited(meal.idMeal) ? 'Remove ❤️' : 'Save ❤️'}</button>
    </div>
  `;

  modal.setAttribute('open','');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');

  const shareBtn = document.getElementById('shareBtn');
  const modalFavBtn = document.getElementById('modalFavBtn');

  shareBtn.addEventListener('click', async () => {
    const text = shareText;
    const url = meal.strSource || meal.strYoutube || window.location.href;
    if(navigator.share){
      try { await navigator.share({title: meal.strMeal, text, url}); }
      catch(err){ console.warn('Share canceled', err); }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert('Recipe copied to clipboard — paste to share!');
      } catch(e){ alert('Unable to share: ' + e); }
    }
  });

  modalFavBtn.addEventListener('click', () => {
    toggleFavorite(meal);
    modalFavBtn.textContent = isFavorited(meal.idMeal) ? 'Remove ❤️' : 'Save ❤️';
  });
}

function escapeHtml(s){ return s ? s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') : '' }

closeModal?.addEventListener('click', closeRecipeModal);
modal?.addEventListener('click', (e) => { if(e.target === modal) closeRecipeModal(); });
function closeRecipeModal(){
  modal.removeAttribute('open');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden','true');
  modalBody.innerHTML = '';
}

function loadFavorites(){
  try{
    const raw = localStorage.getItem(LS_FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveFavorites(){
  localStorage.setItem(LS_FAV_KEY, JSON.stringify(favorites));
  updateFavCount();
}
function isFavorited(id){
  return favorites.some(f => f.idMeal === id);
}
function toggleFavorite(meal, btnEl){
  const exists = isFavorited(meal.idMeal);
  if(exists){
    favorites = favorites.filter(f => f.idMeal !== meal.idMeal);
    if(btnEl) { btnEl.classList.remove('saved'); btnEl.textContent = '🤍'; }
  } else {
    const clone = {
      idMeal: meal.idMeal,
      strMeal: meal.strMeal,
      strMealThumb: meal.strMealThumb,
      _cookTime: meal._cookTime || genCookTime(),
      _nutrition: meal._nutrition || genNutrition()
    };
    favorites.unshift(clone);
    if(btnEl){ btnEl.classList.add('saved'); btnEl.textContent = '❤️'; }
  }
  saveFavorites();
  renderFavoritesList();
}

favoritesBtn.addEventListener('click', () => {
  favoritesModal.setAttribute('open','');
  favoritesModal.style.display = 'flex';
  favoritesModal.setAttribute('aria-hidden','false');
  renderFavoritesList();
});
closeFavorites.addEventListener('click', () => {
  favoritesModal.removeAttribute('open');
  favoritesModal.style.display = 'none';
  favoritesModal.setAttribute('aria-hidden','true');
});
favoritesModal.addEventListener('click', (e)=> { if(e.target === favoritesModal) { closeFavorites.click(); } });

function renderFavoritesList(){
  favoritesList.innerHTML = '';
  if(!favorites || favorites.length === 0){
    noFavsMsg.style.display = 'block';
    favCount.textContent = 0;
    return;
  }
  noFavsMsg.style.display = 'none';
  favorites.forEach(item => {
    const div = document.createElement('div');
    div.className = 'fav-item';
    div.innerHTML = `
      <img src="${item.strMealThumb}" alt="${escapeHtml(item.strMeal)}" />
      <div style="flex:1">
        <strong>${escapeHtml(item.strMeal)}</strong>
        <div class="muted">${item._cookTime}</div>
      </div>
      <button class="remove-fav" data-id="${item.idMeal}" title="Remove">Remove</button>
    `;
    favoritesList.appendChild(div);
  });

  favoritesList.querySelectorAll('.remove-fav').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      favorites = favorites.filter(f => f.idMeal !== id);
      saveFavorites();
      renderFavoritesList();
    });
  });

  favCount.textContent = favorites.length;
}

function updateFavCount(){ favCount.textContent = favorites.length; }

// Theme (dark/light)
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem(LS_THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
});
function applySavedTheme(){
  const val = localStorage.getItem(LS_THEME_KEY);
  if(val === 'dark') document.body.classList.add('dark');
}

// Basic app behavior: initial featured recipes (random search terms)
const seedTerms = ['chicken','beef','pasta','salad','dessert','cake','fish'];

async function loadFeatured(){
  recipeContainer.innerHTML = `<p class="muted">Loading featured recipes...</p>`;
  const picks = shuffleArray(seedTerms).slice(0,6);
  const promises = picks.map(t => fetchRecipes(t).catch(()=>null));
  const results = await Promise.all(promises);
  const flat = (results.flat().filter(Boolean) || []).reduce((acc,m)=>{
    if(!acc.find(x=>x.idMeal===m.idMeal)) acc.push(m);
    return acc;
  }, []);
  flat.forEach(m => { if(!m._cookTime) m._cookTime = genCookTime(); if(!m._nutrition) m._nutrition = genNutrition(); });
  renderRecipes(flat.slice(0,12));
}

function shuffleArray(arr){ return arr.slice().sort(()=>Math.random()-0.5); }

searchBtn.addEventListener('click', async () => {
  const q = searchInput.value.trim();
  if(!q) return;
  recipeContainer.innerHTML = `<p class="muted">Searching for "${q}" ...</p>`;
  const meals = await fetchRecipes(q);
  if(meals){
    meals.forEach(m=>{ if(!m._cookTime) m._cookTime = genCookTime(); if(!m._nutrition) m._nutrition = genNutrition(); });
  }
  renderRecipes(meals);
});

randomBtn.addEventListener('click', async ()=>{
  recipeContainer.innerHTML = `<p class="muted">Loading a random recipe...</p>`;
  const meal = await fetchRandom();
  if(meal){
    meal._cookTime = genCookTime();
    meal._nutrition = genNutrition();
    renderRecipes([meal]);
  } else {
    recipeContainer.innerHTML = `<p class="muted">Could not load a random recipe. Try again.</p>`;
  }
});

loadFeatured();

window.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') {
    if(modal.getAttribute('open')) closeRecipeModal();
    if(favoritesModal.getAttribute('open')) closeFavorites.click();
  }
});

