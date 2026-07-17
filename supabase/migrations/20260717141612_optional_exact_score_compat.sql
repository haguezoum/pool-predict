alter table pool_predict.bets
  drop constraint bets_prediction_score;

alter table pool_predict.bets
  add constraint bets_prediction_score check (
    prediction = 'validate'
    or (prediction = 'not_validate' and predicted_score is null)
  );

alter table pool_predict.score_events
  drop constraint score_events_points;

alter table pool_predict.score_events
  add constraint score_events_points check (
    (type = 'exact' and points = 3)
    or (type = 'correct' and points in (1, 2))
    or (type = 'wrong' and points = -1)
    or (type = 'no_bet' and points = -2)
  );
