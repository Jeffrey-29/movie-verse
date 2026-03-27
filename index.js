import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const TMDB_TOKEN = process.env.TMDB_TOKEN;

app.set("view engine", "ejs");
app.use(express.static("public"));

/* ================= CACHE ================= */

let cachedTrending = [];
let cachedLatest = [];
let cachedTopRated = [];
let cachedGenres = [];

/* ================= HOME PAGE ================= */

app.get("/", async (req, res) => {

try {

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

let trending = [];
let latest = [];
let topRated = [];
let genres = [];


/* ---------- Trending ---------- */

try {

const resTrending = await fetch(
`https://api.themoviedb.org/3/trending/movie/week`,
{ headers }
);

if (!resTrending.ok) throw new Error("Trending failed");

const data = await resTrending.json();

trending = data.results || [];
cachedTrending = trending;

} catch (error) {

console.log("Trending Error:", error.message);
trending = cachedTrending;

}


/* ---------- Latest ---------- */

try {

const resLatest = await fetch(
`https://api.themoviedb.org/3/movie/now_playing`,
{ headers }
);

if (!resLatest.ok) throw new Error("Latest failed");

const data = await resLatest.json();

latest = data.results || [];
cachedLatest = latest;

} catch (error) {

console.log("Latest Error:", error.message);
latest = cachedLatest;

}


/* ---------- Top Rated ---------- */

try {

const resTop = await fetch(
`https://api.themoviedb.org/3/movie/top_rated`,
{ headers }
);

if (!resTop.ok) throw new Error("Top rated failed");

const data = await resTop.json();

topRated = data.results || [];
cachedTopRated = topRated;

} catch (error) {

console.log("Top Rated Error:", error.message);
topRated = cachedTopRated;

}


/* ---------- Genres ---------- */

try {

const resGenre = await fetch(
`https://api.themoviedb.org/3/genre/movie/list`,
{ headers }
);

if (!resGenre.ok) throw new Error("Genre failed");

const data = await resGenre.json();

genres = data.genres || [];
cachedGenres = genres;

} catch (error) {

console.log("Genre Error:", error.message);
genres = cachedGenres;

}


res.render("index.ejs", {
movies: null,
trending,
latest,
topRated,
genres,
searchQuery: null,
notFound: false
});

} catch (error) {

console.log("Home Error:", error.message);

res.render("index.ejs", {
movies:null,
trending:[],
latest:[],
topRated:[],
genres:[],
searchQuery:null,
notFound:false
});

}

});



/* ================= SEARCH ================= */

app.get("/search", async (req, res) => {

try {

const movie = req.query.movie;

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

const responses = await Promise.allSettled([
fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(movie)}&page=1`, { headers }),
fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(movie)}&page=2`, { headers }),
fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(movie)}&page=3`, { headers }),
fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(movie)}&page=4`, { headers })
]);

let movies = [];

for (const resItem of responses) {

if (resItem.status === "fulfilled") {

const data = await resItem.value.json();

movies.push(
...(data.results || []).filter(
item => item.media_type === "movie"
)
);

}

}

movies = movies.sort((a, b) => b.popularity - a.popularity);


/* ---------- OMDB fallback ---------- */

if (movies.length === 0) {

const omdb = await fetch(
`https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${movie}`
);

const omdbData = await omdb.json();

movies = (omdbData.Search || []).map(m => ({
id: m.imdbID,
title: m.Title,
release_date: m.Year,
poster_path: m.Poster !== "N/A" ? m.Poster : null,
isOMDB: true
}));

}

res.render("index.ejs", {
movies,
trending:null,
latest:null,
topRated:null,
genres:null,
searchQuery: movie,
notFound: movies.length === 0
});

} catch (error) {

console.log(error.message);

res.render("index.ejs", {
movies: [],
trending:null,
latest:null,
topRated:null,
genres:null,
searchQuery: null,
notFound: true
});

}

});



/* ================= SEARCH SUGGEST ================= */

app.get("/suggest", async (req,res)=>{

try {

const query = req.query.q;

if(!query || query.length < 2){
return res.json([]);
}

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

const response = await fetch(
`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`,
{headers}
);

const data = await response.json();

res.json(data.results.slice(0,5));

} catch{
res.json([]);
}

});



/* ================= MOVIE DETAILS ================= */

app.get("/movie/:id", async (req, res) => {

try {

const movieId = req.params.id;

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};


/* ---------- Movie ---------- */

const movieRes = await fetch(
`https://api.themoviedb.org/3/movie/${movieId}`,
{ headers }
);

const movie = await movieRes.json();


/* ---------- Providers ---------- */

const providerRes = await fetch(
`https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
{ headers }
);

const providerData = await providerRes.json();

const providers = providerData.results?.IN || providerData.results?.US || null;


/* ---------- Trailer ---------- */

const videoRes = await fetch(
`https://api.themoviedb.org/3/movie/${movieId}/videos`,
{ headers }
);

const videoData = await videoRes.json();

const trailer = videoData.results?.find(
v => v.type === "Trailer" && v.site === "YouTube"
);


/* ---------- Cast ---------- */

const castRes = await fetch(
`https://api.themoviedb.org/3/movie/${movieId}/credits`,
{ headers }
);

const castData = await castRes.json();

const cast = castData.cast?.slice(0,10);


/* ---------- Similar ---------- */

const similarRes = await fetch(
`https://api.themoviedb.org/3/movie/${movieId}/similar`,
{ headers }
);

const similarData = await similarRes.json();

const similar = similarData.results?.slice(0,12);


res.render("movie", {
movie,
providers,
trailer,
cast,
similar
});

} catch {

console.log("Movie Fetch Failed");

res.redirect("/");

}

});


/* ================= ACTOR PAGE ================= */

app.get("/actor/:id", async (req,res)=>{

try {

const id = req.params.id;

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

const actorRes = await fetch(
`https://api.themoviedb.org/3/person/${id}`,
{headers}
);

const actor = await actorRes.json();


const movieRes = await fetch(
`https://api.themoviedb.org/3/person/${id}/movie_credits`,
{headers}
);

const movieData = await movieRes.json();

const movies = movieData.cast.slice(0,12);

res.render("actor",{
actor,
movies
});

} catch {

res.redirect("/");

}

});


/* ================= GENRE ================= */

app.get("/genre/:id", async (req,res)=>{

try {

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

const genreId = req.params.id;

const response = await fetch(
`https://api.themoviedb.org/3/discover/movie?with_genres=${genreId}`,
{headers}
);

const data = await response.json();

res.render("index.ejs",{
movies:data.results,
trending:null,
latest:null,
topRated:null,
genres:null,
searchQuery:null,
notFound:false
});

} catch{

console.log("Genre Error");
res.redirect("/");

}

});


app.listen(port, () => {
console.log(`Server running on port ${port}`);
});