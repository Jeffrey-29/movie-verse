import express from "express";
import dotenv from "dotenv";
dotenv.config();


const app = express();
const port = process.env.PORT || 3000;

const TMDB_TOKEN = process.env.TMDB_TOKEN;

app.set("view engine", "ejs");
app.use(express.static("public", {
maxAge: 0
}));

/* ================= CACHE ================= */

let cachedTrending = [];
let cachedLatest = [];
let cachedTopRated = [];
let cachedGenres = [];


/* ================= GLOBAL GENRES ================= */
app.use(async (req,res,next)=>{

try{

if(!cachedGenres.length){

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

const [movieGenres,tvGenres] = await Promise.all([

fetch(
"https://api.themoviedb.org/3/genre/movie/list",
{headers}
),

fetch(
"https://api.themoviedb.org/3/genre/tv/list",
{headers}
)

]);

const movieData = await movieGenres.json()
const tvData = await tvGenres.json()

const movie = (movieData.genres || []).map(g=>({
...g,
type:"movie"
}))

const tv = (tvData.genres || []).map(g=>({
...g,
type:"tv"
}))

cachedGenres = [...movie,...tv]

}

res.locals.genres = cachedGenres

}catch{

res.locals.genres = []

}

next()

})


/* ================= HOME ================= */

app.get("/", async (req, res) => {

try {

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

let trending = [];
let latest = [];
let topRated = [];
let topPicks = [];


/* ---------- Trending ---------- */

/* ---------- Trending ---------- */


try {

const [movieTrending, tvTrending] = await Promise.all([
fetch("https://api.themoviedb.org/3/trending/movie/week",{headers}),
fetch("https://api.themoviedb.org/3/trending/tv/week",{headers})
]);

const movieData = await movieTrending.json();
const tvData = await tvTrending.json();

trending = [
...(movieData.results || []),
...(tvData.results || [])
];

/* fallback if empty */

if(!trending.length){

const [moviePopular, tvPopular] = await Promise.all([
fetch("https://api.themoviedb.org/3/movie/popular",{headers}),
fetch("https://api.themoviedb.org/3/tv/popular",{headers})
]);

const moviePop = await moviePopular.json();
const tvPop = await tvPopular.json();

trending = [
...(moviePop.results || []),
...(tvPop.results || [])
];

}

cachedTrending = trending;

/* ---------- Top Picks With Trailer ---------- */

topPicks = await Promise.all(
trending.slice(0,5).map(async(movie)=>{

try{

const type = movie.first_air_date ? "tv" : "movie"

const videoRes = await fetch(
`https://api.themoviedb.org/3/${type}/${movie.id}/videos`,
{headers}
)

const videoData = await videoRes.json()

const trailer =
videoData.results?.find(
v => v.type === "Trailer" && v.site === "YouTube"
) ||
videoData.results?.find(
v => v.type === "Teaser" && v.site === "YouTube"
) ||
videoData.results?.find(
v => v.site === "YouTube"
)
return {
...movie,
trailer: trailer?.key || null
}

}catch{

return movie

}

})
)

} catch {

trending = cachedTrending;

}

/* ---------- Latest ---------- */

/* ---------- Latest ---------- */

try {

const [movieLatest, tvLatest] = await Promise.all([
fetch("https://api.themoviedb.org/3/movie/popular",{headers}),
fetch("https://api.themoviedb.org/3/tv/popular",{headers})
]);

const movieData = await movieLatest.json();
const tvData = await tvLatest.json();

latest = [
...(movieData.results || []),
...(tvData.results || [])
]

cachedLatest = latest;

} catch {

latest = cachedLatest;

}

/* ---------- Top Rated ---------- */

try {

const [movieTop, tvTop] = await Promise.all([
fetch("https://api.themoviedb.org/3/movie/top_rated",{headers}),
fetch("https://api.themoviedb.org/3/tv/top_rated",{headers})
]);

const movieData = await movieTop.json();
const tvData = await tvTop.json();

topRated = [
...(movieData.results || []),
...(tvData.results || [])
]

cachedTopRated = topRated;

} catch {

topRated = cachedTopRated;

}


res.render("index", {
movies:null,
topPicks,
trending,
latest,
topRated,
searchQuery:null,
notFound:false
});

} catch {

res.render("index",{
movies:null,
topPicks:[],
trending:[],
latest:[],
topRated:[],
searchQuery:null,
notFound:false
})

}

});


/* ================= SEARCH ================= */

app.get("/search", async (req,res)=>{

try{

const query = req.query.movie

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

const response = await fetch(
`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
{headers}
)

const data = await response.json()

const movies = data.results.filter(
item => item.media_type === "movie" || item.media_type === "tv"
)

res.render("index",{
movies,
trending:null,
latest:null,
topRated:null,
searchQuery:query,
notFound:movies.length===0
})

}catch{

res.redirect("/")

}

})


/* ================= SEARCH SUGGEST ================= */

app.get("/suggest", async(req,res)=>{

try{

const query = req.query.q

if(!query || query.length<2){
return res.json([])
}

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

const response = await fetch(
`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
{headers}
)

const data = await response.json()

const results = data.results.filter(
item => item.media_type === "movie" || item.media_type === "tv"
)

res.json(results.slice(0,5))

}catch{

res.json([])

}

})


/* ================= MOVIE / TV ================= */

app.get("/movie/:id", async (req,res)=>{

try{

const id = req.params.id

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

/* detect movie or tv */

let movie
let isTV = false

let movieRes = await fetch(
`https://api.themoviedb.org/3/movie/${id}`,
{headers}
)

movie = await movieRes.json()

if(movie.success === false || movie.status_code === 34){

movieRes = await fetch(
`https://api.themoviedb.org/3/tv/${id}`,
{headers}
)

movie = await movieRes.json()

isTV = true

}


/* providers */

const providerRes = await fetch(
`https://api.themoviedb.org/3/${isTV ? "tv" : "movie"}/${id}/watch/providers`,
{headers}
)

const providerData = await providerRes.json()

const providers =
providerData.results?.IN ||
providerData.results?.US ||
null


/* trailer */

const videoRes = await fetch(
`https://api.themoviedb.org/3/${isTV?"tv":"movie"}/${id}/videos`,
{headers}
)

const videoData = await videoRes.json()

const trailer = videoData.results?.find(
v=>v.type==="Trailer" && v.site==="YouTube"
)


/* cast */

const castRes = await fetch(
`https://api.themoviedb.org/3/${isTV?"tv":"movie"}/${id}/credits`,
{headers}
)

const castData = await castRes.json()

const cast = castData.cast?.slice(0,10)


/* similar */

const similarRes = await fetch(
`https://api.themoviedb.org/3/${isTV?"tv":"movie"}/${id}/similar`,
{headers}
)

const similarData = await similarRes.json()

const similar = similarData.results?.slice(0,12)


res.render("movie",{
movie,
providers,
trailer,
cast,
similar
})

}catch{

res.redirect("/")

}

})


/* ================= ACTOR ================= */

app.get("/actor/:id", async(req,res)=>{

try{

const id = req.params.id

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

const actorRes = await fetch(
`https://api.themoviedb.org/3/person/${id}`,
{headers}
)

const actor = await actorRes.json()


const movieRes = await fetch(
`https://api.themoviedb.org/3/person/${id}/combined_credits`,
{headers}
)

const movieData = await movieRes.json()

const movies = movieData.cast.slice(0,12)

res.render("actor",{
actor,
movies
})

}catch{

res.redirect("/")

}

})

/* ================= FILTER ================= */

app.get("/filter", async (req,res)=>{

try{

const { type, year, rating, sort, page, certificate } = req.query;
const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

let url = `https://api.themoviedb.org/3/discover/${type || "movie"}?page=${page || 1}&`;

if(year){
url += `primary_release_year=${year}&`
}

if(rating){
url += `vote_average.gte=${rating}&`
}

if(certificate){
url += `certification_country=IN&certification=${certificate}&`
}

if(sort){
url += `sort_by=${sort}&`
}

const response = await fetch(url,{headers})
const data = await response.json()

res.json(data)

}catch{

res.json({results:[]})

}

})



/* ================= GENRE ================= */

app.get("/genre/:type/:id", async(req,res)=>{

try{

const id = req.params.id
const type = req.params.type

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
}

/* Get genre name */

const genreList = cachedGenres || []
const genre = genreList.find(g => g.id == id && g.type == type)

/* Get movies */

const response = await fetch(
`https://api.themoviedb.org/3/discover/${type}?with_genres=${id}`,
{headers}
)

const data = await response.json()

res.render("index",{
movies:data.results || [],
genreName: genre ? genre.name : "Genre",
trending:null,
latest:null,
topRated:null,
searchQuery:null,
notFound:(data.results || []).length===0
})

}catch{

res.redirect("/")

}

})

app.get("/wishlist",(req,res)=>{

res.render("wishlist")

})


app.get("/recommend/:id", async (req, res) => {

const id = req.params.id;

try {

const headers = {
Authorization:`Bearer ${TMDB_TOKEN}`,
accept:"application/json"
};

/* detect movie or tv */

let movieRes = await fetch(
`https://api.themoviedb.org/3/movie/${id}`,
{headers}
);

let movie = await movieRes.json();
let isTV = false;

if(movie.success === false || movie.status_code === 34){

movieRes = await fetch(
`https://api.themoviedb.org/3/tv/${id}`,
{headers}
);

movie = await movieRes.json();
isTV = true;

}

const genre = movie.genres?.[0]?.id;

if(!genre) return res.json([]);


/* fetch recommendations based on genre */

const [popular, topRated] = await Promise.all([

fetch(
`https://api.themoviedb.org/3/discover/${isTV?"tv":"movie"}?with_genres=${genre}&sort_by=popularity.desc`,
{headers}
),

fetch(
`https://api.themoviedb.org/3/discover/${isTV?"tv":"movie"}?with_genres=${genre}&sort_by=vote_average.desc&vote_count.gte=100`,
{headers}
)

]);

const popularData = await popular.json();
const topData = await topRated.json();

const results = [
...(popularData.results || []),
...(topData.results || [])
];

res.json(results.slice(0,12));

} catch (error) {

console.log(error.message);
res.json([]);

}

});



app.listen(port,()=>{
console.log(`Server running on port ${port}`)
})