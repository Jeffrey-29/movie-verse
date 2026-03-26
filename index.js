import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const TMDB_TOKEN = process.env.TMDB_TOKEN;
app.use(express.static("public"));

/* ================= HOME PAGE ================= */

app.get("/", async (req, res) => {

try {

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

// Fetch one by one (more stable)

const trendingRes = await fetch(
`https://api.themoviedb.org/3/trending/movie/week`,
{ headers }
);

const latestRes = await fetch(
`https://api.themoviedb.org/3/movie/now_playing`,
{ headers }
);

const topRatedRes = await fetch(
`https://api.themoviedb.org/3/movie/top_rated`,
{ headers }
);

const genreRes = await fetch(
`https://api.themoviedb.org/3/genre/movie/list`,
{ headers }
);

const trendingData = await trendingRes.json();
const latestData = await latestRes.json();
const topRatedData = await topRatedRes.json();
const genreData = await genreRes.json();

console.log("Trending:", trendingData.results?.length);
console.log("Latest:", latestData.results?.length);
console.log("TopRated:", topRatedData.results?.length);

res.render("index.ejs", {
movies: null,
trending: trendingData.results || [],
latest: latestData.results || [],
topRated: topRatedData.results || [],
genres: genreData.genres || [],
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

for (const res of responses) {
if (res.status === "fulfilled") {
const data = await res.value.json();

movies.push(
...(data.results || []).filter(item =>
item.media_type === "movie"
)
);
}
}

movies = movies.sort((a, b) => b.popularity - a.popularity);

/* OMDB fallback */

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


/* ================= MOVIE DETAILS ================= */

app.get("/movie/:id", async (req, res) => {

try {

const id = req.params.id;

const response = await fetch(
`https://api.themoviedb.org/3/movie/${id}`,
{
headers: {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
}
}
);

const data = await response.json();

res.render("movie.ejs", {
movie: data
});

} catch (error) {

console.log(error.message);
res.redirect("/");

}

});


/* ================= GENRE ================= */

app.get("/genre/:id", async (req,res)=>{

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

});


/* ================= LOAD MORE ================= */

app.get("/load-more", async (req,res)=>{

const page = req.query.page;

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

const response = await fetch(
`https://api.themoviedb.org/3/movie/popular?page=${page}`,
{headers}
);

const data = await response.json();

res.json(data.results);

});


/* ================= SEARCH SUGGEST ================= */

app.get("/suggest", async (req,res)=>{

const query = req.query.q;

const headers = {
Authorization: `Bearer ${TMDB_TOKEN}`,
accept: "application/json"
};

const response = await fetch(
`https://api.themoviedb.org/3/search/movie?query=${query}`,
{headers}
);

const data = await response.json();

res.json(data.results.slice(0,5));

});


app.listen(port, () => {
console.log(`Server running on port ${port}`);
});