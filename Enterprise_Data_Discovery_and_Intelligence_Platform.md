# **Project Title: DataScope – Enterprise Data Discovery & Intelligence Platform**

## **Project Overview**

Build a modern Enterprise Data Discovery & Intelligence Platform designed to help organizations explore, search, filter, analyze, and manage large volumes of structured business data.

DataScope is designed for organizations that maintain millions of records across different business domains.

Users should be able to explore large datasets, perform advanced searches, apply multiple filters, sort records, inspect detailed information, and save frequently used queries.

The platform should provide a highly responsive and efficient user experience, even when working with large datasets.

## **1\. Business Problem**

**Organizations frequently face problems when working with large datasets:**

* Searching through millions of records.  
* Loading large amounts of data efficiently.  
* Managing multiple filters simultaneously.  
* Maintaining responsive interfaces.  
* Handling expensive database queries.  
* Preventing unnecessary API requests.  
* Managing pagination and sorting.  
* Keeping frontend data synchronized.  
* Handling frequently changing datasets.

DataScope aims to solve these problems through a centralized data discovery platform.

## **2\. Platform Users**

The application should support three user roles.

### **A. Administrator**

* Manage platform users.  
* Manage data collections.  
* Configure data access permissions.  
* View platform-wide analytics.  
* Manage system configurations.

### **B. Data Analyst**

* Explore available datasets.  
* Perform advanced searches.  
* Apply multiple filters.  
* Create and save search queries.  
* Analyze records.  
* Export selected data.

### **C. Viewer**

* Browse authorized datasets.  
* Search records.  
* Apply basic filters.  
* View record details.  
* Access saved shared views.

## **3\. Core Platform Features**

### **A. Dataset Management**

Administrators should be able to create and manage datasets.

**Each dataset should contain:**

* Dataset Name.  
* Description.  
* Category.  
* Data Source.  
* Total Records.  
* Created Date.  
* Last Updated Date.  
* Access Permissions.

For the initial version, use a generated dataset containing at least 100,000 records.

Your application should also demonstrate how its architecture could support datasets containing millions of records.

### **B. Data Explorer**

Create a powerful data exploration interface.

**Users should be able to:**

* Browse datasets.  
* View records in a table.  
* Search records.  
* Sort columns.  
* Apply multiple filters.  
* Open individual record details.  
* Customize visible columns.  
* Save frequently used views.

The interface should support dynamic filters based on dataset fields.

### **C. Advanced Search**

**Implement a search system that supports:**

* Global Search.  
* Field-Based Search.  
* Multiple Search Conditions.  
* Exact Match.  
* Partial Match.  
* Date Range Search.  
* Numeric Range Search.  
* Combined Filters.

**Example:**

**A user should be able to search for records where:**

* Status \= Active.  
* Country \= Germany.  
* Revenue \> \$10,000.  
* Created Date \= Last 30 Days.

All conditions should work together.

### **D. Sorting & Pagination**

**Users should be able to:**

* Sort by multiple columns.  
* Change sorting direction.  
* Navigate between pages.  
* Change page size.  
* Jump to a specific page when supported.  
* Maintain filter and sorting states while navigating.

You must choose an appropriate pagination strategy and explain why it is suitable.

### **E. Record Details**

**When a user opens a record, display:**

* Complete Record Information.  
* Related Records.  
* Historical Changes (where available).  
* Created Date.  
* Updated Date.

The detail interface should be designed to handle large and complex records without affecting the overall application experience.

## **4\. Data Fetching Architecture**

This is one of the most important assessment areas.

You must design and implement an efficient data-fetching system.

**Your application should demonstrate:**

* Server-side Data Fetching.  
* Client-side Data Fetching.  
* Caching.  
* Cache Invalidation.  
* Request Deduplication.  
* Loading State Management.  
* Error Handling.  
* Background Refreshing.  
* Pagination-Based Fetching.

You must decide which data should be fetched on the server and which should be fetched on the client.

You must explain the reason behind your decision.

### **Mandatory Data Fetching Questions**

**Your documentation and presentation must answer:**

1. Why did you select your data-fetching approach?  
2. Why did you choose RTK Query, Redux Async Thunks, or another suitable strategy?  
3. What alternatives did you consider?  
4. How do you prevent unnecessary API calls?  
5. How do you handle multiple simultaneous requests?  
6. How do you manage stale data?  
7. How do you handle API failures?  
8. How do you synchronize frontend state after data changes?  
9. How do you handle slow network connections?  
10. How would your solution behave with millions of records?

## **5\. Large-Scale Search & Query Optimization**

The platform must demonstrate efficient searching across large datasets.

You should implement an appropriate search architecture using PostgreSQL.

**Consider:**

* Database Indexing.  
* Composite Indexes.  
* Full-Text Search.  
* Query Optimization.  
* Debouncing.  
* Server-Side Filtering.  
* Server-Side Sorting.  
* Pagination.  
* Search Result Caching.

### **Search Performance Requirements**

**Your search system should:**

* Avoid downloading the entire dataset to the frontend.  
* Execute filtering on the backend.  
* Support multiple simultaneous search conditions.  
* Handle empty and invalid search queries.  
* Prevent excessive API requests.  
* Maintain search state during navigation.

### **Alternative Search Approaches**

**You must investigate and compare at least three possible approaches:**

* PostgreSQL Full-Text Search.  
* PostgreSQL Trigram Search.  
* External Search Engines such as Elasticsearch or OpenSearch.

Explain which approach you selected for your implementation and why.

You should also discuss when your selected approach might stop being sufficient.

## **6\. Frontend Architecture & System Design**

Design the frontend as a scalable and maintainable application.

**Your frontend should have a clear separation between:**

* Pages.  
* Layouts.  
* Components.  
* Feature Modules.  
* API Services.  
* State Management.  
* Hooks.  
* Utilities.  
* Types.

### **Required Frontend Modules**

* Authentication.  
* Dataset Management.  
* Data Explorer.  
* Advanced Search.  
* Filter Builder.  
* Saved Views.  
* Record Details.  
* Analytics.  
* User Settings.

### **Frontend Architecture Requirements**

**Explain and implement:**

* Component Architecture.  
* Feature-Based Folder Structure.  
* Global State Management.  
* Server State Management.  
* URL-Based Search State.  
* Reusable Data Table Components.  
* Error Boundaries.  
* Loading Skeletons.  
* Responsive Layout.

You must explain how your architecture will remain maintainable when new features are added.

## **7\. Advanced Data Table System**

The Data Explorer should include a professional data table.

**Required features:**

* Dynamic Columns.  
* Column Sorting.  
* Multi-Column Sorting.  
* Column Visibility.  
* Column Resizing.  
* Pagination.  
* Multi-Row Selection.  
* Row Details.  
* Advanced Filtering.  
* Search Highlighting.

### **Performance Requirements**

**Consider implementing:**

* Virtualized Rows.  
* Lazy Loading.  
* Server-Side Pagination.  
* Memoized Components.  
* Efficient Rendering.

Explain which optimization techniques you selected and what performance problem each one solves.

## **8\. Saved Views & Search History**

Users should be able to save their frequently used search configurations.

**Each saved view should contain:**

* View Name.  
* Dataset.  
* Search Conditions.  
* Filters.  
* Sorting Configuration.  
* Visible Columns.  
* Created Date.

**Users should be able to:**

* Save views.  
* Edit views.  
* Delete views.  
* Reuse saved views.  
* Share views with authorized team members.

Also maintain a search history containing recently executed queries.

## **9\. Data Analytics**

Create an analytics section using Recharts or Chart.js.

**Include:**

* Total Records.  
* Records by Category.  
* Records by Status.  
* Data Growth Trends.  
* Search Activity.  
* Most Frequently Used Filters.

All analytics should be generated from actual dataset records.

Avoid loading all records into the frontend to calculate statistics.

Use appropriate backend aggregation queries.

## **10\. Redux Toolkit (Mandatory)**

Redux Toolkit must be used for global application state management.

**Required implementation:**

* Redux Store Configuration.  
* Authentication Slice.  
* Dataset Slice.  
* Search Configuration Slice.  
* Saved Views Slice.  
* UI Preference Slice.

Use RTK Query or Redux Async Thunks for API communication.

**You must clearly distinguish between:**

* Global Client State.  
* Server State.  
* URL State.  
* Temporary Component State.

Avoid storing large datasets unnecessarily inside Redux.

Explain why you selected your state management strategy and what alternatives you considered.

## **11\. Backend & Database Requirements**

Use PostgreSQL as the primary database.

Use Drizzle ORM for database management.

**Suggested entities:**

* Users.  
* Roles.  
* Datasets.  
* DatasetFields.  
* DatasetRecords.  
* RecordRelationships.  
* SavedViews.  
* SearchHistory.  
* UserPreferences.  
* AccessPermissions.

**Implement:**

* Proper Database Indexing.  
* Query Optimization.  
* Pagination.  
* Filtering.  
* Sorting.  
* Data Validation.  
* Access Control.  
* Database Migrations.

The backend should expose well-structured REST APIs.

All search and filtering operations should be handled efficiently on the server.

## **12\. Professional UI/UX Requirements**

The platform should look like a modern enterprise data management product.

**Required pages:**

### **Public Pages**

* Landing Page.  
* Login.  
* Registration.

### **Application Pages**

* Overview Dashboard.  
* Dataset Library.  
* Data Explorer.  
* Advanced Search.  
* Saved Views.  
* Search History.  
* Record Details.  
* Analytics.  
* User Settings.

### **Design Requirements**

* Professional Sidebar Navigation.  
* Modern Data Tables.  
* Advanced Filter Interface.  
* Search Builder.  
* Dynamic Column Management.  
* Interactive Charts.  
* Responsive Layout.  
* Loading Skeletons.  
* Empty States.  
* Error States.  
* Toast Notifications.

The Data Explorer should be the central focus of the application.

Avoid generic dashboard designs. The application should feel like a professional enterprise data tool.

## **13\. Security & Authorization**

Implement authentication using NextAuth or a custom authentication solution.

**Required roles:**

* Administrator.  
* Data Analyst.  
* Viewer.

**Implement:**

* Role-Based Access Control.  
* Dataset-Level Permissions.  
* Protected Routes.  
* Server-Side Authorization.  
* Secure API Endpoints.  
* Input Validation.  
* Search Query Validation.

Users must not be able to access unauthorized datasets by manipulating request parameters or frontend state.

## **14\. Testing & Performance**

Your application should demonstrate proper engineering practices.

**Required test areas:**

* Authentication.  
* Dataset Access Permissions.  
* Search Logic.  
* Combined Filters.  
* Sorting.  
* Pagination.  
* Saved Views.  
* Data Fetching.  
* Cache Invalidation.  
* API Error Handling.

**Include:**

* Unit Tests.  
* Integration Tests.  
* API Tests.

You must also conduct performance testing with large datasets.

### **Performance Evaluation**

**Demonstrate:**

* Search response time.  
* Pagination response time.  
* Large table rendering performance.  
* API request frequency.  
* Cache effectiveness.  
* Front-end responsiveness.

Submit measurable results from your test environment.

Do not claim production-level performance based only on a small local dataset.

## **15\. Mandatory Technical Decision Documentation**

You must document at least 8 major technical decisions.

**Examples:**

1. Why did you choose RTK Query instead of Redux Async Thunks?  
2. Why did you choose Server-Side Pagination instead of Client-Side Pagination?  
3. Why did you choose PostgreSQL over MongoDB?  
4. Why did you select Offset Pagination or Cursor Pagination?  
5. Why did you choose PostgreSQL Full-Text Search instead of Elasticsearch?  
6. Why did you use Debouncing?  
7. Why did you choose Virtualization or Lazy Loading?  
8. How did you decide which data should be cached?  
9. Why did you choose URL-based filter state?  
10. How did you separate Server State and Client State?

**For every decision, explain:**

* Problem.  
* Available Alternatives.  
* Selected Approach.  
* Reason for Selection.  
* Advantages.  
* Disadvantages.  
* Performance Implications.  
* Future Limitations.

## **16\. Tech Stack**

### **Full-Stack Development**

* Next.js (App Router).  
* TypeScript.  
* Node.js.  
* Express.js  
* Authentication.

### **Database Management**

* PostgreSQL.

### **Software Engineering**

* Database Design.  
* Clean Code.  
* System Design.  
* Testing.  
* Scalability.  
* Industry Best Practices.

### **AI Engineering (Optional Extension)**

* LLM.  
* Prompt Engineering.  
* Tool Calling.  
* AI Guardrails.

### **Production & Deployment**

* GitHub Actions.  
* CI/CD.

## **17\. Bonus Challenges**

### **A. Query Builder**

Create a visual query builder that allows users to construct complex search conditions without writing SQL.

### **B. Export Engine**

Allow users to export filtered results as CSV.

The export process should support large datasets without loading everything into frontend memory.

### **C. Background Export Processing**

For large exports, create background jobs and notify users when the file is ready.

### **D. Search Query Sharing**

Allow users to share saved search configurations with authorized team members.

### **E. AI Search Assistant**

Allow users to describe search requirements in natural language.

**Example:**

*"Find active customers from Germany with revenue greater than \$10,000."*

The AI should convert the request into a validated search configuration.

The system must validate the generated conditions before executing any query.

### **F. Search Performance Monitoring**

**Create a dashboard showing:**

* Most Expensive Queries.  
* Average Search Time.  
* Frequently Used Filters.  
* Cache Hit Rate.  
* Slow API Requests.