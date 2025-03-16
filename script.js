 // Global variables
 let users = [];
 let currentUser = null;
 let groupSettings = null;
 let recommendations = [];
 let ratingValue = 0;
 let readingHistory = [];

 // The Open Library API base URL
 const OPEN_LIBRARY_API = 'https://openlibrary.org';

 // Page turning function
 function turnPage(pageId) {
     // Get current active page
     const activePage = document.querySelector('.page:not(.hidden)');

     // Add turning animation class
     if (activePage) {
         activePage.classList.add('turning-out');

         setTimeout(() => {
             // Hide current page
             activePage.classList.add('hidden');
             activePage.classList.remove('turning-out');

             // Show new page
             const nextPage = document.querySelector(`.page.${pageId}`);
             nextPage.classList.remove('hidden');
             nextPage.classList.add('turning-in');

             setTimeout(() => {
                 nextPage.classList.remove('turning-in');
             }, 50);
         }, 300);
     }
 }

 // Initialize event listeners when DOM is loaded
 document.addEventListener('DOMContentLoaded', function() {
     // Add listeners for forms
     const preferencesForm = document.getElementById('preferences-form');
     if (preferencesForm) {
         preferencesForm.addEventListener('submit', function(e) {
             e.preventDefault();
             saveUserPreferences();
             turnPage('group-setup');
         });
     }

     const groupForm = document.getElementById('group-form');
     if (groupForm) {
         groupForm.addEventListener('submit', function(e) {
             e.preventDefault();
             saveGroupSettings();
             generateRecommendations();
             turnPage('results');
         });
     }

     // Add member button
     const addMemberBtn = document.getElementById('add-member');
     if (addMemberBtn) {
         addMemberBtn.addEventListener('click', function() {
             // Save current user before switching to add a new one
             if (currentUser) {
                 users.push(currentUser);
                 updateMembersList();
             }

             // Reset form for new member
             document.getElementById('preferences-form').reset();

             // Go back to preferences page
             turnPage('quiz');
         });
     }

     // Rating stars
     const stars = document.querySelectorAll('.star');
     stars.forEach(star => {
         star.addEventListener('click', function() {
             const value = parseInt(this.getAttribute('data-value'));
             ratingValue = value;

             // Update visual selection
             stars.forEach(s => {
                 if (parseInt(s.getAttribute('data-value')) <= value) {
                     s.classList.add('selected');
                 } else {
                     s.classList.remove('selected');
                 }
             });
         });
     });

     // Submit rating button
     const submitRatingBtn = document.getElementById('submit-rating');
     if (submitRatingBtn) {
         submitRatingBtn.addEventListener('click', function() {
             if (ratingValue > 0) {
                 saveRating();
                 alert('Thank you for your rating! We\'ll use this to improve future recommendations.');
                 updateReadingHistory();
                 turnPage('history');
             } else {
                 alert('Please select a rating before submitting.');
             }
         });
     }

     // New recommendations button
     const newRecommendationsBtn = document.getElementById('new-recommendations');
     if (newRecommendationsBtn) {
         newRecommendationsBtn.addEventListener('click', function() {
             generateRecommendations();
             turnPage('results');
         });
     }

     // Load any saved reading history
     loadReadingHistory();
 });

 // Save user preferences from form
 function saveUserPreferences() {
     const form = document.getElementById('preferences-form');
     const formData = new FormData(form);

     // Get selected genres (checkboxes can have multiple values)
     const genres = formData.getAll('genre');

     const user = {
         name: formData.get('name'),
         preferences: {
             genres: genres,
             length: formData.get('length'),
             era: formData.get('era'),
             pace: formData.get('pace'),
             mood: formData.get('mood'),
             favoriteBooks: formData.get('favorite-books')
         }
     };

     // Store user data
     currentUser = user;

     // If this is adding a subsequent user, update members list
     if (users.length > 0) {
         users.push(currentUser);
         updateMembersList();
         currentUser = null;
     }
 }

 // Save group settings
 function saveGroupSettings() {
     // Add the current user to the users array if not already added
     if (currentUser) {
         users.push(currentUser);
         currentUser = null;
     }

     // Get group settings
     const groupName = document.getElementById('group-name').value;
     const meetingFrequency = document.getElementById('meeting-frequency').value;

     groupSettings = {
         name: groupName,
         meetingFrequency: meetingFrequency
     };
 }

 // Update the members list display
 function updateMembersList() {
     const membersList = document.getElementById('members');
     membersList.innerHTML = '';

     users.forEach((user, index) => {
         const li = document.createElement('li');
         li.innerHTML = `
            ${user.name} (${user.preferences.genres.join(', ')})
            <button type="button" class="remove-member" data-index="${index}">Remove</button>
        `;
         membersList.appendChild(li);
     });

     // Add event listeners for remove buttons
     document.querySelectorAll('.remove-member').forEach(button => {
         button.addEventListener('click', function() {
             const index = parseInt(this.getAttribute('data-index'));
             users.splice(index, 1);
             updateMembersList();
         });
     });
 }

 // Generate book recommendations based on user preferences using Open Library API
 async function generateRecommendations() {
     const resultsDiv = document.getElementById('book-results');
     resultsDiv.innerHTML = '<div class="loading">Finding the perfect matches for your group...</div>';

     try {
         // Aggregate all user preferences
         const allGenres = [];
         const lengthPreferences = [];
         const eraPreferences = [];
         const pacePreferences = [];
         const moodPreferences = [];

         users.forEach(user => {
             // Add genres with no duplicates
             user.preferences.genres.forEach(genre => {
                 if (!allGenres.includes(genre)) {
                     allGenres.push(genre);
                 }
             });

             // Add other preferences
             lengthPreferences.push(user.preferences.length);
             eraPreferences.push(user.preferences.era);
             pacePreferences.push(user.preferences.pace);
             moodPreferences.push(user.preferences.mood);
         });

         // Find the most common preferences
         const length = getMostCommon(lengthPreferences);
         const era = getMostCommon(eraPreferences);
         const pace = getMostCommon(pacePreferences);
         const mood = getMostCommon(moodPreferences);

         // Create a query based on genres and other preferences
         let queryParts = [];

         // Add genres to query
         // We'll use up to 3 genres to keep the query focused but diverse
         if (allGenres.length > 0) {
             const topGenres = allGenres.slice(0, Math.min(3, allGenres.length));
             const genreQuery = topGenres.join(' OR ');
             queryParts.push(`(subject:(${genreQuery}))`);
         }

         // Add era to query if it's not 'contemporary' (too broad)
         if (era === 'classic') {
             queryParts.push('(publish_year:[1800 TO 1900])');
         } else if (era === '20th') {
             queryParts.push('(publish_year:[1900 TO 2000])');
         }

         // Build final query
         let query = queryParts.join(' AND ');

         // If no query parts, use a default that returns popular books
         if (!query) {
             query = 'popular';
         }

         // Make API call to Open Library
         const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`);
         const data = await response.json();

         if (data.docs && data.docs.length > 0) {
             // Filter books to meet more of our criteria
             const filteredBooks = data.docs.filter(book => {
                 // Make sure we have the essential data
                 return book.title && book.author_name;
             });

             // Sort by relevance and quality (books with more metadata tend to be better)
             const sortedBooks = filteredBooks.sort((a, b) => {
                 let scoreA = 0;
                 let scoreB = 0;

                 // Books with covers get a bonus
                 if (a.cover_i) scoreA += 2;
                 if (b.cover_i) scoreB += 2;

                 // Books with more complete metadata get a bonus
                 scoreA += a.subject ? a.subject.length * 0.2 : 0;
                 scoreB += b.subject ? b.subject.length * 0.2 : 0;

                 // Bonus for matching length preference
                 const pageCountA = a.number_of_pages_median || 0;
                 const pageCountB = b.number_of_pages_median || 0;

                 if (length === 'short' && pageCountA > 0 && pageCountA < 300) scoreA += 3;
                 if (length === 'medium' && pageCountA >= 300 && pageCountA <= 500) scoreA += 3;
                 if (length === 'long' && pageCountA > 500) scoreA += 3;

                 if (length === 'short' && pageCountB > 0 && pageCountB < 300) scoreB += 3;
                 if (length === 'medium' && pageCountB >= 300 && pageCountB <= 500) scoreB += 3;
                 if (length === 'long' && pageCountB > 500) scoreB += 3;

                 // Tiebreaker: prefer books with ratings if available
                 if (a.ratings_average && b.ratings_average) {
                     return scoreB - scoreA || b.ratings_average - a.ratings_average;
                 }

                 return scoreB - scoreA;
             });

             // Take top books
             recommendations = sortedBooks.slice(0, 5).map(book => ({
                 title: book.title,
                 author: book.author_name?.join(', ') || 'Unknown',
                 firstPublishYear: book.first_publish_year || 'Unknown',
                 coverID: book.cover_i,
                 description: book.description?.value || book.description || generateDescription(book),
                 genres: book.subject?.slice(0, 3) || [],
                 pageCount: book.number_of_pages_median || 'Unknown',
                 rating: book.ratings_average ? book.ratings_average.toFixed(1) : 'N/A',
                 olid: book.key // Open Library ID for the work
             }));

             // Get additional details for each book
             await enrichBookData(recommendations);

             // Display recommendations
             displayRecommendations(recommendations);
         } else {
             // If Open Library doesn't return results, fall back to our backup data
             resultsDiv.innerHTML = '<p>No matching books found from the Open Library. Using our curated recommendations instead:</p>';
             recommendations = getBackupRecommendations(allGenres, length, era, pace, mood);
             displayRecommendations(recommendations);
         }
     } catch (error) {
         console.error('Error generating recommendations:', error);
         resultsDiv.innerHTML = '<div class="empty-state">Error finding book recommendations. Using backup recommendations:</div>';
         recommendations = getBackupRecommendations([], '', '', '', '');
         displayRecommendations(recommendations);
     }
 }

 // Enrich book data with additional details (if available)
 async function enrichBookData(books) {
     for (let book of books) {
         if (book.olid) {
             try {
                 // Try to get more details about the book
                 const workId = book.olid.replace('/works/', '');
                 const response = await fetch(`${OPEN_LIBRARY_API}/works/${workId}.json`);

                 if (response.ok) {
                     const workData = await response.json();

                     // Update description if available
                     if (workData.description) {
                         if (typeof workData.description === 'object') {
                             book.description = workData.description.value || book.description;
                         } else {
                             book.description = workData.description || book.description;
                         }
                     }

                     // Add subjects if available
                     if (workData.subjects && !book.genres.length) {
                         book.genres = workData.subjects.slice(0, 3);
                     }
                 }
             } catch (e) {
                 console.log('Could not fetch additional data for book:', e);
                 // Continue without the additional data
             }
         }
     }
 }

 // Helper function to get the most common item in an array
 function getMostCommon(arr) {
     if (arr.length === 0) return null;

     const counts = {};
     arr.forEach(item => {
         counts[item] = (counts[item] || 0) + 1;
     });

     let maxCount = 0;
     let maxItem = null;

     for (const item in counts) {
         if (counts[item] > maxCount) {
             maxCount = counts[item];
             maxItem = item;
         }
     }

     return maxItem;
 }

 // Generate a description for books that don't have one
 function generateDescription(book) {
     // Create a generic description based on available metadata
     let description = `"${book.title}" `;

     if (book.first_publish_year) {
         description += `was first published in ${book.first_publish_year}. `;
     }

     if (book.subject && book.subject.length) {
         description += `This book is categorized as ${book.subject.slice(0, 3).join(', ')}. `;
     }

     if (book.number_of_pages_median) {
         description += `It's a ${book.number_of_pages_median} page read. `;
     }

     description += `It's highly recommended for book clubs looking to explore works by ${book.author_name?.[0] || 'this author'}.`;

     return description;
 }

 // Display book recommendations in the results page
 function displayRecommendations(books) {
     const resultsDiv = document.getElementById('book-results');
     resultsDiv.innerHTML = '';

     if (books.length === 0) {
         resultsDiv.innerHTML = '<div class="empty-state">No matching books found. Try adjusting your preferences.</div>';
         return;
     }

     books.forEach(book => {
         const bookDiv = document.createElement('div');
         bookDiv.className = 'book-recommendation';

         // Get cover image URL or use a placeholder
         let coverUrl = book.coverID ?
             `https://covers.openlibrary.org/b/id/${book.coverID}-M.jpg` :
             'https://via.placeholder.com/100x150?text=No+Cover';

         bookDiv.innerHTML = `
            <img src="${coverUrl}" alt="${book.title} cover" class="book-cover">
            <div class="book-info">
                <h3>${book.title}</h3>
                <div class="author">by ${book.author}</div>
                <div class="description">${book.description}</div>
                <div class="meta">
                    <span class="meta-item">Published: ${book.firstPublishYear}</span>
                    ${book.pageCount !== 'Unknown' ? `<span class="meta-item">Pages: ${book.pageCount}</span>` : ''}
                    ${book.rating !== 'N/A' ? `<span class="meta-item">Rating: ${book.rating}/5</span>` : ''}
                    ${book.genres.map(genre => `<span class="meta-item">${genre}</span>`).join('')}
                </div>
            </div>
        `;

         resultsDiv.appendChild(bookDiv);
     });
 }

 // Save rating for current recommendations
 function saveRating() {
     // In a real app, this would send the rating to a backend
     // For now, we'll just store it locally

     // Create a new history entry
     const historyEntry = {
         date: new Date().toLocaleDateString(),
         books: recommendations,
         rating: ratingValue,
         group: groupSettings.name
     };

     // Add to reading history
     readingHistory.push(historyEntry);

     // Save to localStorage
     try {
         localStorage.setItem('readingHistory', JSON.stringify(readingHistory));
     } catch (e) {
         console.error('Could not save to localStorage:', e);
     }

     // Reset rating value and stars
     ratingValue = 0;
     document.querySelectorAll('.star').forEach(star => {
         star.classList.remove('selected');
     });
 }

 // Update the reading history display
 function updateReadingHistory() {
     const historyList = document.getElementById('history-list');

     if (readingHistory.length === 0) {
         historyList.innerHTML = '<p class="empty-state">Your reading history will appear here after you\'ve rated books.</p>';
         return;
     }

     historyList.innerHTML = '';

     readingHistory.forEach(entry => {
         const historyDiv = document.createElement('div');
         historyDiv.className = 'history-item';

         // Get the first book as the main display book
         const mainBook = entry.books[0];

         historyDiv.innerHTML = `
            <div class="date">${entry.date} - Group: ${entry.group}</div>
            <h3>Top Pick: ${mainBook.title}</h3>
            <div class="author">by ${mainBook.author}</div>
            <div class="rating">Your Group's Rating: ${'★'.repeat(entry.rating)}${'☆'.repeat(5-entry.rating)}</div>
            <div class="other-books">
                <strong>Other recommendations:</strong> 
                ${entry.books.slice(1).map(book => book.title).join(', ')}
            </div>
        `;

         historyList.appendChild(historyDiv);
     });
 }

 // Load reading history from localStorage if available
 function loadReadingHistory() {
     try {
         const savedHistory = localStorage.getItem('readingHistory');
         if (savedHistory) {
             readingHistory = JSON.parse(savedHistory);
         }
     } catch (e) {
         console.error('Could not load reading history:', e);
     }
 }

 // Backup book database for fallback recommendations
 const backupBookDatabase = [{
         title: "The Night Circus",
         author: "Erin Morgenstern",
         genres: ["fiction", "fantasy", "romance"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "thoughtful",
         description: "A competition between two young magicians becomes a remarkable duel of imagination that develops into a love story.",
         coverID: null,
         firstPublishYear: 2011,
         pageCount: 387
     },
     {
         title: "Where the Crawdads Sing",
         author: "Delia Owens",
         genres: ["fiction", "mystery"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "thoughtful",
         description: "A painful coming-of-age story and a surprising tale of possible murder, intertwined with a beautiful ode to the natural world.",
         coverID: null,
         firstPublishYear: 2018,
         pageCount: 384
     },
     {
         title: "Project Hail Mary",
         author: "Andy Weir",
         genres: ["science_fiction", "fiction"],
         length: "medium",
         era: "contemporary",
         pace: "fast",
         mood: "thoughtful",
         description: "A lone astronaut must save the earth from disaster in this masterful science fiction thriller of discovery, speculation, and survival.",
         coverID: null,
         firstPublishYear: 2021,
         pageCount: 496
     },
     {
         title: "The Seven Husbands of Evelyn Hugo",
         author: "Taylor Jenkins Reid",
         genres: ["fiction", "historical_fiction", "romance"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "thoughtful",
         description: "The story of a fictional Hollywood movie icon and her seven marriages, revealing the ambition, friendship, and love that defined her life.",
         coverID: null,
         firstPublishYear: 2017,
         pageCount: 389
     },
     {
         title: "Educated",
         author: "Tara Westover",
         genres: ["non_fiction", "biography", "memoir"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "thoughtful",
         description: "A memoir about growing up in a survivalist family in Idaho and the author's journey to education at Brigham Young University and beyond.",
         coverID: null,
         firstPublishYear: 2018,
         pageCount: 334
     },
     {
         title: "The Silent Patient",
         author: "Alex Michaelides",
         genres: ["mystery", "thriller", "fiction"],
         length: "short",
         era: "contemporary",
         pace: "fast",
         mood: "dark",
         description: "A famous painter shoots her husband and then never speaks another word, becoming the silent patient at the center of this psychological thriller.",
         coverID: null,
         firstPublishYear: 2019,
         pageCount: 325
     },
     {
         title: "The House in the Cerulean Sea",
         author: "TJ Klune",
         genres: ["fantasy", "fiction"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "uplifting",
         description: "A magical island. A dangerous task. A burning secret. An enchanting love story about the profound experience of discovering an unlikely family in an unexpected place.",
         coverID: null,
         firstPublishYear: 2020,
         pageCount: 396
     },
     {
         title: "A Gentleman in Moscow",
         author: "Amor Towles",
         genres: ["historical_fiction", "fiction"],
         length: "medium",
         era: "20th",
         pace: "slow",
         mood: "thoughtful",
         description: "In 1922, Count Alexander Rostov is sentenced to house arrest in the Metropol, a grand hotel across from the Kremlin, where he lives through some of the most tumultuous decades in Russian history.",
         coverID: null,
         firstPublishYear: 2016,
         pageCount: 462
     },
     {
         title: "The Four Winds",
         author: "Kristin Hannah",
         genres: ["historical_fiction", "fiction"],
         length: "medium",
         era: "20th",
         pace: "moderate",
         mood: "thoughtful",
         description: "A sweeping novel about the strength and resilience of women and the bond between mother and daughter, set during the Great Depression.",
         coverID: null,
         firstPublishYear: 2021,
         pageCount: 464
     },
     {
         title: "Anxious People",
         author: "Fredrik Backman",
         genres: ["fiction", "contemporary"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "funny",
         description: "A poignant comedy about a crime that never took place, a would-be bank robber who disappears into thin air, and eight extremely anxious strangers who find they have more in common than they ever imagined.",
         coverID: null,
         firstPublishYear: 2019,
         pageCount: 336
     },
     {
         title: "To Kill a Mockingbird",
         author: "Harper Lee",
         genres: ["fiction", "historical_fiction", "classics"],
         length: "medium",
         era: "classic",
         pace: "moderate",
         mood: "thoughtful",
         description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, through the eyes of a young girl named Scout.",
         coverID: null,
         firstPublishYear: 1960,
         pageCount: 324
     },
     {
         title: "The Midnight Library",
         author: "Matt Haig",
         genres: ["fiction", "fantasy", "science_fiction"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "thoughtful",
         description: "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.",
         coverID: null,
         firstPublishYear: 2020,
         pageCount: 304
     },
     {
         title: "Pride and Prejudice",
         author: "Jane Austen",
         genres: ["fiction", "classics", "romance"],
         length: "medium",
         era: "classic",
         pace: "slow",
         mood: "thoughtful",
         description: "The tale of Elizabeth Bennet and her prejudice against the seemingly proud Mr. Darcy, and his struggle to overcome his own pride in his love for her.",
         coverID: null,
         firstPublishYear: 1813,
         pageCount: 279
     },
     {
         title: "The Great Gatsby",
         author: "F. Scott Fitzgerald",
         genres: ["fiction", "classics"],
         length: "short",
         era: "classic",
         pace: "moderate",
         mood: "thoughtful",
         description: "The story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan, set against the backdrop of the Jazz Age.",
         coverID: null,
         firstPublishYear: 1925,
         pageCount: 180
     },
     {
         title: "Good Omens",
         author: "Terry Pratchett & Neil Gaiman",
         genres: ["fantasy", "fiction", "humor"],
         length: "medium",
         era: "contemporary",
         pace: "moderate",
         mood: "funny",
         description: "The world is going to end next Saturday, just before dinner, but it turns out there are a few problems - the Antichrist has been misplaced, and the Four Horsemen of the Apocalypse ride motorcycles.",
         coverID: null,
         firstPublishYear: 1990,
         pageCount: 288
     }
 ];

 // Fallback function for generating recommendations without APIs
 function getBackupRecommendations(preferredGenres, length, era, pace, mood) {
     // Score each book based on how well it matches the preferences
     const scoredBooks = backupBookDatabase.map(book => {
         let score = 0;

         // Match genres
         preferredGenres.forEach(genre => {
             if (book.genres.includes(genre)) {
                 score += 3; // High weight for genre matches
             }
         });

         // Match other criteria
         if (book.length === length) score += 2;
         if (book.era === era) score += 2;
         if (book.pace === pace) score += 1;
         if (book.mood === mood) score += 2;

         return {
             ...book,
             score
         };
     });

     // Sort by score descending
     scoredBooks.sort((a, b) => b.score - a.score);

     // If no strong matches, return a diverse set of good books
     if (scoredBooks[0].score < 3) {
         return backupBookDatabase
             .sort(() => 0.5 - Math.random()) // Shuffle
             .slice(0, 5); // Take first 5
     }

     // Otherwise return top 5 matches
     return scoredBooks.slice(0, 5);
 }

 // 3D cursor interaction for book
 document.addEventListener('DOMContentLoaded', function() {
     const book = document.getElementById('book');
     const container = document.getElementById('book-container');

     if (book && container) {
         // Only enable on devices that likely have a mouse
         if (window.matchMedia("(min-width: 769px)").matches) {
             container.addEventListener('mousemove', function(e) {
                 handleBookRotation(e, book, container);
             });

             container.addEventListener('mouseleave', function() {
                 resetBookRotation(book);
             });
         }
     }

     // Add the multi-page-effect to all pages if not added in HTML
     document.querySelectorAll('.page').forEach(page => {
         if (!page.querySelector('.multi-page-effect')) {
             const multiPageEffect = document.createElement('div');
             multiPageEffect.className = 'multi-page-effect';

             // Add page layers
             for (let i = 0; i < 5; i++) {
                 const layer = document.createElement('div');
                 layer.className = 'page-layer';
                 multiPageEffect.appendChild(layer);
             }

             // Add page edge
             const pageEdge = document.createElement('div');
             pageEdge.className = 'page-edge';
             multiPageEffect.appendChild(pageEdge);

             page.appendChild(multiPageEffect);
         }
     });
 });

 // Handle book rotation based on mouse position
 function handleBookRotation(e, book, container) {
     const rect = container.getBoundingClientRect();

     // Calculate mouse position relative to the center of the container
     const mouseX = e.clientX - rect.left - rect.width / 2;
     const mouseY = e.clientY - rect.top - rect.height / 2;

     // Calculate rotation angles based on mouse position
     // Limit rotation to reasonable values
     const rotateY = Math.min(Math.max(-20 + (mouseX / rect.width * 10), -25), -5);
     const rotateX = Math.min(Math.max(5 - (mouseY / rect.height * 5), 0), 10);

     // Apply rotation with some easing using CSS class
     book.classList.add('cursor-rotate-effect');
     book.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
 }

 // Reset book rotation when mouse leaves
 function resetBookRotation(book) {
     book.style.transform = 'rotateY(-20deg) rotateX(5deg)';
 }

 // Enhance the page turning function for better visual effect
 function turnPage(pageId) {
     // Get current active page
     const activePage = document.querySelector('.page:not(.hidden)');
     const direction = getPageDirection(activePage, pageId);

     // Add turning animation class based on direction
     if (activePage) {
         activePage.classList.add(direction === 'forward' ? 'turning-out' : 'turning-in');

         setTimeout(() => {
             // Hide current page
             activePage.classList.add('hidden');
             activePage.classList.remove('turning-out', 'turning-in');

             // Show new page
             const nextPage = document.querySelector(`.page.${pageId}`);
             nextPage.classList.remove('hidden');
             nextPage.classList.add(direction === 'forward' ? 'turning-in' : 'turning-out');

             setTimeout(() => {
                 nextPage.classList.remove('turning-in', 'turning-out');
             }, 50);
         }, 500); // Increased for a more noticeable turn effect
     }
 }

 // Determine page turn direction (forward or backward)
 function getPageDirection(currentPage, newPageId) {
     const pageOrder = ['foreword', 'quiz', 'group-setup', 'results', 'history'];

     if (!currentPage) return 'forward';

     const currentPageIndex = pageOrder.findIndex(id => currentPage.classList.contains(id));
     const newPageIndex = pageOrder.findIndex(id => id === newPageId);

     return newPageIndex > currentPageIndex ? 'forward' : 'backward';
 }