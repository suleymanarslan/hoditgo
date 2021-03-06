package routers

import (
	"hoditgo/controllers"
	"hoditgo/core/authentication"
	"hoditgo/core/system"

	"github.com/codegangsta/negroni"
	"github.com/gorilla/mux"
)

func SetHelloRoutes(router *mux.Router) *mux.Router {
	router.Handle("/test/hello",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.HelloController),
		)).Methods("GET")

	return router
}

func SetAppCommonRoutes(router *mux.Router) *mux.Router {
    
    router.Handle("/create-interview",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.CreateInterview),
		)).Methods("POST")
    
    router.Handle("/create-interviewer",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.CreateInterviewer),
		)).Methods("POST")
		
	router.Handle("/update-interviewersummary",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.UpdateInterviewerSummary),
		)).Methods("POST")
		
	router.Handle("/update-interviewerranking",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.UpdateInterviewerRanking),
		)).Methods("POST")
		
			router.Handle("/get-interviewerid",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.GetInterviewerById),
		)).Methods("GET")
					router.Handle("/get-interviewername",
		negroni.New(
			negroni.HandlerFunc(authentication.RequireTokenAuthentication),
			negroni.HandlerFunc(controllers.GetInterviewerByName),
		)).Methods("GET")
        
	router.HandleFunc("/create-user", controllers.CreateUser).Methods("POST")
	router.HandleFunc("/signal", system.ServeWs)
	return router
}

